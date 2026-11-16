import { describe, expect, it } from 'vitest';
import {
  aggregateHardware,
  canonicalJson,
  computePositions,
  computeMaterialAreas,
  deriveModel,
  generateOutputs,
  presetMaterials,
  type FurnitureModel,
  type HardwareItem,
} from '@/domain';
import { makeBox, makePart } from '@/domain/derive/frames';
import { formatArea } from '@/i18n';
import { model, template } from './fixtures';

describe('positions and cut list (T-006)', () => {
  it('AC-027: bookcase positions follow the role order and group identical parts', () => {
    const doc = template('bookcase');
    const out = generateOutputs(doc, model(doc));
    expect(out.positions.map((p) => [p.position, p.role, p.quantity])).toEqual([
      [1, 'side-left', 1],
      [2, 'side-right', 1],
      [3, 'top', 1],
      [4, 'bottom', 1],
      [5, 'divider', 1],
      [6, 'fixed-shelf', 4],
      [7, 'adjustable-shelf', 4],
      [8, 'back', 1],
    ]);
    expect(out.cutList.map((g) => [g.materialId, g.rows.map((r) => r.position)])).toEqual([
      ['mat-ply-18', [1, 2, 3, 4, 5, 6, 7]],
      ['mat-hdf-3', [8]],
    ]);
    const fixedRow = out.cutList[0]!.rows[5]!;
    expect(fixedRow).toMatchObject({
      finished: { lengthMm: 373, widthMm: 297, thicknessMm: 18 },
      cut: { lengthMm: 373, widthMm: 297 },
      grain: 'length',
      bandedEdges: { u: 0, v: 1 },
    });
    expect(fixedRow.partIds).toHaveLength(4);
  });

  it('cut list follows the order of the materials array', () => {
    const doc = template('blank');
    doc.materials.reverse();
    const out = generateOutputs(doc, model(doc));
    expect(out.cutList.map((g) => g.materialId)).toEqual(['mat-hdf-3', 'mat-ply-18']);
  });

  it('AC-028: melamine door 796 × 396.5 with 1 mm banding on 4 edges cuts to 794 × 394.5', () => {
    const doc = template('blank');
    const mel = presetMaterials().find((m) => m.id === 'mat-mel-19')!;
    const door = makePart('door:x:S', 'door', 'x', mel, makeBox(2, 398.5, 2, 798, 400, 419));
    const synthetic: FurnitureModel = { ...model(doc), parts: [door] };
    const [group] = computePositions(doc, synthetic);
    expect(group).toMatchObject({
      finished: { lengthMm: 796, widthMm: 396.5, thicknessMm: 19 },
      cut: { lengthMm: 794, widthMm: 394.5 },
      bandedEdges: ['u0', 'u1', 'v0', 'v1'],
    });
  });

  it('L-13: banding overrides drive cut-size deduction', () => {
    const doc = template('blank');
    doc.carcass.materialIds.carcass = 'mat-mel-19';
    doc.bandingOverrides = { top: ['u0', 'u1'] };
    const m = model(doc);
    const top = m.parts.find((p) => p.id === 'top')!;
    expect(top.bandedEdges).toEqual(['u0', 'u1']);

    const out = generateOutputs(doc, m);
    const row = out.cutList.flatMap((g) => g.rows).find((r) => r.role === 'top')!;
    expect(row.finished).toMatchObject({ lengthMm: top.lengthMm, widthMm: top.widthMm });
    expect(row.cut).toEqual({ lengthMm: top.lengthMm - 2, widthMm: top.widthMm });
  });
});

describe('hardware list (T-006)', () => {
  const item = (key: string, kind: HardwareItem['kind'], quantity: number): HardwareItem => ({
    key,
    kind,
    labelParams: { label: key },
    quantity,
    unit: 'pcs',
    profileKey: kind === 'hinge' ? 'hinge' : null,
    partIds: [],
  });

  it('AC-029: spare on screws, nails and pins after summing; none on hinges', () => {
    const doc = template('blank');
    const rows = aggregateHardware(doc, [
      item('back:nail', 'nail', 60),
      item('screw:carcass', 'screw', 30),
      item('screw:carcass', 'screw', 31),
      item('pin', 'shelf-pin', 8),
      item('hinge:full', 'hinge', 5),
    ]);
    expect(rows.map((r) => [r.key, r.quantity, r.spareIncluded])).toEqual([
      ['back:nail', 66, 6],
      ['screw:carcass', 68, 7],
      ['pin', 9, 1],
      ['hinge:full', 5, 0],
    ]);
    expect(rows[3]).toMatchObject({ verified: false, label: { key: 'hardware.hinge' } });
  });

  it('AC-029: edge banding in m with waste, rounded up to 0.1 m; wall anchor for tall pieces', () => {
    const doc = template('bookcase');
    const out = generateOutputs(doc, model(doc));
    // 2 × 2000 + 2 × 764 + 1964 + 4 × 373 + 4 × 371 = 10468 mm × 1.1 = 11.5148 m → 11.6 m
    expect(out.hardware).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'edge-band:mat-ply-18', kind: 'edge-band', quantity: 11.6, unit: 'm' }),
        expect.objectContaining({ key: 'wall-anchor', quantity: 1 }),
      ]),
    );
  });
});

describe('area per material (price estimate)', () => {
  it('sums cut sizes × quantity per material, rounded up to 0.01 m²', () => {
    const doc = template('bookcase');
    const out = generateOutputs(doc, model(doc));
    const areas = computeMaterialAreas(out.cutList);
    expect(areas.map((a) => a.materialId)).toEqual(out.cutList.map((g) => g.materialId));
    for (const group of out.cutList) {
      const mm2 = group.rows.reduce((s, r) => s + r.cut.lengthMm * r.cut.widthMm * r.quantity, 0);
      const area = areas.find((a) => a.materialId === group.materialId)!;
      expect(area.areaM2).toBe(Math.ceil(mm2 / 10_000) / 100);
      expect(area.areaM2 * 1e6).toBeGreaterThanOrEqual(mm2);
      expect(area.parts).toBe(group.rows.reduce((n, r) => n + r.quantity, 0));
    }
    // Back panel 2000 × 800 HDF: 1.60 m².
    expect(areas.find((a) => a.materialId === 'mat-hdf-3')?.areaM2).toBe(1.6);
  });

  it('formats square metres with two decimals per language', () => {
    expect(formatArea('en', 1.6)).toBe('1.60 m²');
    expect(formatArea('de', 12.345)).toBe('12,35 m²');
  });
});

describe('determinism (AC-041, T-006)', () => {
  it.each(['bookcase', 'blank'] as const)('%s: canonical outputs are byte-identical across runs', (id) => {
    const run = () => {
      const doc = template(id);
      const result = deriveModel(doc);
      if (!result.ok) throw new Error('derive failed');
      return canonicalJson({ model: result.model, outputs: generateOutputs(doc, result.model) });
    };
    expect(run()).toBe(run());
  });

  it('canonicalJson sorts keys and rounds numbers', () => {
    expect(canonicalJson({ b: 1.04999, a: [2.25, -0.01], c: undefined })).toBe('{\n  "a": [\n    2.3,\n    0\n  ],\n  "b": 1\n}');
    expect(() => canonicalJson({ x: Number.NaN })).toThrow();
  });
});
