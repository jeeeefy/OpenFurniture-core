import { describe, expect, it } from 'vitest';
import { computeCuttingLayouts, generateOutputs, TEMPLATE_IDS, type CutListGroup, type DesignDocument, type MaterialLayout } from '@/domain';
import { carcassDesign, codes, model, template } from './fixtures';

function group(materialId: string, parts: [number, number, number][]): CutListGroup {
  return {
    materialId,
    rows: parts.map(([length, width, quantity], i) => ({
      position: i + 1,
      role: 'fixed-shelf',
      quantity,
      partIds: Array.from({ length: quantity }, (_, k) => `p${String(i + 1)}-${String(k)}`),
      finished: { lengthMm: length, widthMm: width, thicknessMm: 18 },
      cut: { lengthMm: length, widthMm: width },
      grain: 'length',
      bandedEdges: { u: 0, v: 0 },
    })),
  };
}

function withCutting(doc: DesignDocument, kerf: number, trim: number, grain = true): DesignDocument {
  doc.construction.sawKerfMm = kerf;
  doc.construction.sheetTrimMm = trim;
  for (const m of doc.materials) m.hasGrain = grain;
  return doc;
}

/** Placements stay inside the trimmed sheet and keep at least one kerf between parts. */
function assertValid(layout: MaterialLayout): void {
  const { kerfMm: k, trimMm: t } = layout;
  for (const sheet of layout.sheets) {
    const { lengthMm: SL, widthMm: SW } = sheet;
    const ps = sheet.placements;
    for (const p of ps) {
      expect(p.xMm).toBeGreaterThanOrEqual(t - 1e-6);
      expect(p.yMm).toBeGreaterThanOrEqual(t - 1e-6);
      expect(p.xMm + p.alongMm).toBeLessThanOrEqual(SL - t + 1e-6);
      expect(p.yMm + p.acrossMm).toBeLessThanOrEqual(SW - t + 1e-6);
      if (layout.grain) expect(p.rotated).toBe(false);
    }
    for (let i = 0; i < ps.length; i += 1) {
      for (let j = i + 1; j < ps.length; j += 1) {
        const a = ps[i]!;
        const b = ps[j]!;
        const apart =
          a.xMm + a.alongMm + k <= b.xMm + 1e-6 ||
          b.xMm + b.alongMm + k <= a.xMm + 1e-6 ||
          a.yMm + a.acrossMm + k <= b.yMm + 1e-6 ||
          b.yMm + b.acrossMm + k <= a.yMm + 1e-6;
        expect(apart, `${a.partId} / ${b.partId}`).toBe(true);
      }
    }
  }
}

describe('cutting layouts (guillotine, kerf, trim)', () => {
  it.each(TEMPLATE_IDS)('%s: every part placed once, valid, deterministic, never below the area bound', (id) => {
    const doc = template(id);
    const m = model(doc);
    const out = generateOutputs(doc, m);
    for (const layout of out.cuttingLayouts) {
      assertValid(layout);
      expect(layout.unplaced).toEqual([]);
      const group = out.cutList.find((g) => g.materialId === layout.materialId)!;
      const placed = layout.sheets.flatMap((s) => s.placements.map((p) => p.partId)).sort();
      expect(placed).toEqual(group.rows.flatMap((r) => r.partIds).sort());
      const sheet = layout.sheets[0]!;
      const usable = (sheet.lengthMm - 2 * layout.trimMm) * (sheet.widthMm - 2 * layout.trimMm);
      const area = group.rows.reduce((s, r) => s + r.cut.lengthMm * r.cut.widthMm * r.quantity, 0);
      expect(layout.sheets.length).toBeGreaterThanOrEqual(Math.ceil(area / usable));
      expect(layout.utilisation).toBeLessThanOrEqual(1);
    }
    expect(generateOutputs(doc, m).cuttingLayouts).toEqual(out.cuttingLayouts);
  });

  it('four quarter sheets fit one sheet without kerf and trim; with a 3 mm kerf each needs its own sheet', () => {
    const doc = withCutting(template('blank'), 0, 0);
    const parts = group('mat-ply-18', [[1250, 625, 4]]);
    expect(computeCuttingLayouts(doc, [parts])[0]?.sheets).toHaveLength(1);
    withCutting(doc, 3, 0);
    // 2 × 1250 + 3 > 2500 and 2 × 625 + 3 > 1250.
    expect(computeCuttingLayouts(doc, [parts])[0]?.sheets).toHaveLength(4);
  });

  it('grain keeps parts unrotated; without grain parts may turn to fit', () => {
    // 1200 × 2400 only fits a 2500 × 1250 sheet when turned.
    const tall = group('mat-ply-18', [[1200, 2400, 1]]);
    const grain = withCutting(template('blank'), 3, 5, true);
    expect(computeCuttingLayouts(grain, [tall])[0]?.unplaced).toEqual([{ position: 1, partId: 'p1-0' }]);
    const plain = withCutting(template('blank'), 3, 5, false);
    const layout = computeCuttingLayouts(plain, [tall])[0]!;
    expect(layout.unplaced).toEqual([]);
    expect(layout.sheets[0]?.placements[0]?.rotated).toBe(true);
    assertValid(layout);
  });

  it('a bigger board needs fewer sheets', () => {
    const doc = withCutting(template('blank'), 3, 5);
    // 1000 × 500: 2 × 2 per 2500 × 1250 sheet, 3 × 3 per 3050 × 1525 sheet.
    const parts = group('mat-ply-18', [[1000, 500, 6]]);
    const small = computeCuttingLayouts(doc, [parts])[0]!.sheets.length;
    expect(small).toBe(2);
    doc.materials.find((mt) => mt.id === 'mat-ply-18')!.sheet = { lengthMm: 3050, widthMm: 1525 };
    const big = computeCuttingLayouts(doc, [parts])[0]!;
    assertValid(big);
    expect(big.sheets.length).toBe(1);
  });
});

describe('several board sizes: the mix with the least bought area', () => {
  const ply = (doc: DesignDocument) => doc.materials.find((mt) => mt.id === 'mat-ply-18')!;

  it('large boards plus a small one for the rest', () => {
    const doc = withCutting(template('blank'), 0, 0);
    ply(doc).extraSheets = [{ lengthMm: 1250, widthMm: 625 }];
    const layout = computeCuttingLayouts(doc, [group('mat-ply-18', [[1250, 625, 5]])])[0]!;
    assertValid(layout);
    expect(layout.sizes).toEqual([
      { lengthMm: 2500, widthMm: 1250, count: 1 },
      { lengthMm: 1250, widthMm: 625, count: 1 },
    ]);
    expect(layout.boardAreaM2).toBe(3.91);
  });

  it('only the small board when everything fits on it', () => {
    const doc = withCutting(template('blank'), 3, 5);
    ply(doc).extraSheets = [{ lengthMm: 1250, widthMm: 625 }];
    const layout = computeCuttingLayouts(doc, [group('mat-ply-18', [[600, 300, 2]])])[0]!;
    expect(layout.sheets.map((s) => [s.lengthMm, s.widthMm])).toEqual([[1250, 625]]);
  });

  it('a part that only fits a further size is placed there and is not an error', () => {
    const doc = carcassDesign(600, 2000, 400);
    withCutting(doc, 3, 5);
    ply(doc).sheet = { lengthMm: 1250, widthMm: 625 };
    expect(codes(model(doc))).toContain('PART_EXCEEDS_SHEET');
    ply(doc).extraSheets = [{ lengthMm: 2500, widthMm: 1250 }];
    const m = model(doc);
    expect(codes(m)).not.toContain('PART_EXCEEDS_SHEET');
    const layout = generateOutputs(doc, m).cuttingLayouts.find((l) => l.materialId === 'mat-ply-18')!;
    assertValid(layout);
    expect(layout.unplaced).toEqual([]);
    const sideSheet = layout.sheets.find((s) => s.placements.some((p) => p.partId === 'side:L'))!;
    expect([sideSheet.lengthMm, sideSheet.widthMm]).toEqual([2500, 1250]);
  });
});

describe('cutting layouts (guillotine, kerf, trim) – defaults', () => {
  it('designs without cutting settings use the defaults (3 mm kerf, 5 mm trim)', () => {
    const doc = template('blank');
    delete doc.construction.sawKerfMm;
    delete doc.construction.sheetTrimMm;
    const layout = computeCuttingLayouts(doc, [group('mat-ply-18', [[500, 300, 2]])])[0]!;
    expect([layout.kerfMm, layout.trimMm]).toEqual([3, 5]);
  });
});
