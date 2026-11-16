import { describe, expect, it } from 'vitest';
import { deriveModel, type Part } from '@/domain';
import { deepFreeze } from '../helpers';
import { carcassDesign, codes, model, part, section, setColumns, size, template } from './fixtures';

function inside(p: Part, W: number, H: number, D: number) {
  return p.box.min.every((v) => v >= 0) && p.box.max[0] <= W && p.box.max[1] <= H && p.box.max[2] <= D;
}

function overlapVolume(a: Part, b: Part): number {
  let volume = 1;
  for (let i = 0; i < 3; i += 1) {
    const lo = Math.max(a.box.min[i]!, b.box.min[i]!);
    const hi = Math.min(a.box.max[i]!, b.box.max[i]!);
    volume *= Math.max(0, hi - lo);
  }
  return volume;
}

describe('deriveModel – templates (T-004)', () => {
  it('blank derives exactly 5 parts and no issues (AC-002 domain part)', () => {
    const m = model(template('blank'));
    expect(m.parts.map((p) => p.id)).toEqual(['side:L', 'side:R', 'top', 'bottom', 'back']);
    expect(m.issues).toEqual([]);
  });

  it('bookcase resolves the plan §4.9 layout with only TALL_FURNITURE_ANCHOR', () => {
    const doc = deepFreeze(template('bookcase'));
    const m = model(doc);
    expect(m.layout.columns.map((c) => c.widthMm)).toEqual([373, 373]);
    expect(m.layout.columns[0]!.sections.map((s) => s.heightMm)).toEqual([379, 379, 378, 378, 378]);
    expect(codes(m)).toEqual(['TALL_FURNITURE_ANCHOR']);
    expect(m.parts.filter((p) => p.role === 'fixed-shelf')).toHaveLength(4);
    expect(m.parts.filter((p) => p.role === 'adjustable-shelf')).toHaveLength(4);
    expect(m.parts.filter((p) => p.role === 'divider')).toHaveLength(1);
  });

  it('parts stay inside the envelope and never overlap', () => {
    for (const id of ['blank', 'bookcase'] as const) {
      const doc = template(id);
      const m = model(doc);
      const { widthMm: W, heightMm: H, depthMm: D } = doc.carcass;
      for (const p of m.parts) expect(inside(p, W, H, D), p.id).toBe(true);
      for (let i = 0; i < m.parts.length; i += 1) {
        for (let j = i + 1; j < m.parts.length; j += 1) {
          expect(overlapVolume(m.parts[i]!, m.parts[j]!), `${m.parts[i]!.id} × ${m.parts[j]!.id}`).toBeLessThan(1e-6);
        }
      }
    }
  });

  it('adjustable shelves rest on level pin rows; column 2 rows start at 74 (CON-009)', () => {
    const m = model(template('bookcase'));
    const shelves = m.parts.filter((p) => p.role === 'adjustable-shelf');
    // Pin rows of column 2 start at 0 + 18 + 40 + 16 = 74 and repeat every 32 mm; shelves rest on the pin top (+2.5).
    for (const s of shelves) expect(((s.box.min[1] - 2.5 - 74) % 32 + 32) % 32).toBeCloseTo(0, 6);
    const bottoms = shelves.map((s) => s.box.min[1]);
    expect([...bottoms].sort((a, b) => a - b)).toEqual(bottoms);
  });

  it('L-17: custom shelf positions are sorted and snapped to the nearest pin row', () => {
    const doc = carcassDesign(800, 2000, 300);
    setColumns(doc, [
      [
        section(
          { mode: 'auto' },
          { interior: { kind: 'adjustableShelves', count: 2, positionsMm: [900, 300] } },
        ),
      ],
    ]);
    const m = model(doc);
    const rs = m.layout.columns[0]!.sections[0]!;
    const sectionId = doc.layout.columns[0]!.sections[0]!.id;
    const shelves = m.parts
      .filter((p) => p.role === 'adjustable-shelf' && p.ownerId === sectionId)
      .sort((a, b) => a.box.min[1] - b.box.min[1]);
    const offsets = shelves.map((s) => s.box.min[1] - rs.y0);
    expect(offsets).toHaveLength(2);
    expect(Math.abs(offsets[0]! - 300)).toBeLessThanOrEqual(16);
    expect(Math.abs(offsets[1]! - 900)).toBeLessThanOrEqual(16);
    expect(offsets[1]! - offsets[0]!).toBeGreaterThan(0);
    // The first column has no half-pitch shift: pin rests start at 42.5 and repeat every 32 mm.
    for (const offset of offsets) expect(((offset - 2.5 - 40) % 32 + 32) % 32).toBeCloseTo(0, 6);
  });

  it('L-17: a position list whose length differs from the count falls back to even spacing', () => {
    const doc = carcassDesign(800, 2000, 300);
    setColumns(doc, [
      [
        section(
          { mode: 'auto' },
          { interior: { kind: 'adjustableShelves', count: 2, positionsMm: [300] } },
        ),
      ],
    ]);
    const m = model(doc);
    const rs = m.layout.columns[0]!.sections[0]!;
    const sectionId = doc.layout.columns[0]!.sections[0]!.id;
    const offsets = m.parts
      .filter((p) => p.role === 'adjustable-shelf' && p.ownerId === sectionId)
      .map((p) => p.box.min[1] - rs.y0);
    // Two shelves evenly divide 1964 mm → 654.7 / 1309.3, then snap to pins.
    expect(offsets).toHaveLength(2);
    expect(Math.abs(offsets[0]! - rs.heightMm / 3)).toBeLessThanOrEqual(16);
    expect(Math.abs(offsets[1]! - (2 * rs.heightMm) / 3)).toBeLessThanOrEqual(16);
  });

  it('is deterministic', () => {
    const doc = template('bookcase');
    expect(JSON.stringify(deriveModel(doc))).toBe(JSON.stringify(deriveModel(structuredClone(doc))));
  });

  it('assigns frames and default banded edges', () => {
    const m = model(template('bookcase'));
    expect(part(m, 'side:L').frame).toEqual({ u: 'y', v: 'z', w: 'x' });
    expect(part(m, 'back').frame).toEqual({ u: 'y', v: 'x', w: 'z' });
    expect(part(m, 'top').bandedEdges).toEqual(['v1']);
    expect(part(m, 'back').bandedEdges).toEqual([]);
  });

  it('L-13: banding overrides replace defaults; stale and unbanded parts are ignored', () => {
    const doc = template('bookcase');
    doc.bandingOverrides = { top: ['u0', 'u1'], 'side:L': [], back: ['u0'], missing: ['v0'] };
    const m = model(doc);
    expect(part(m, 'top').bandedEdges).toEqual(['u0', 'u1']);
    expect(part(m, 'side:L').bandedEdges).toEqual([]);
    expect(part(m, 'back').bandedEdges).toEqual([]);
  });
});

describe('deriveModel – issues (T-004)', () => {
  it('AC-007: fixed column widths that do not fit give { ok: false }', () => {
    const doc = carcassDesign(800, 2000, 400);
    setColumns(doc, [[section()], [section()]], [{ mode: 'fixed', valueMm: 500 }, { mode: 'fixed', valueMm: 300 }]);
    const result = deriveModel(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((i) => i.code)).toContain('LAYOUT_COLUMNS_DONT_FIT');
      expect(result.envelope).toEqual({ widthMm: 800, heightMm: 2000, depthMm: 400, depthWithFrontsMm: 400 });
    }
  });

  it('reports COLUMN_TOO_NARROW, LAYOUT_SECTIONS_DONT_FIT and SECTION_TOO_LOW', () => {
    const narrow = carcassDesign(800, 2000, 400);
    setColumns(narrow, [[section()], [section()]], [{ mode: 'fixed', valueMm: 80 }, { mode: 'auto' }]);
    const r1 = deriveModel(narrow);
    expect(!r1.ok && r1.issues.map((i) => i.code)).toEqual(['COLUMN_TOO_NARROW', 'TALL_FURNITURE_ANCHOR']);

    const sections = carcassDesign(800, 1000, 400);
    setColumns(sections, [[section({ mode: 'fixed', valueMm: 500 }), section({ mode: 'fixed', valueMm: 500 })]]);
    const r2 = deriveModel(sections);
    expect(!r2.ok && r2.issues.map((i) => i.code)).toEqual(['LAYOUT_SECTIONS_DONT_FIT', 'TALL_FURNITURE_ANCHOR']);

    const low = carcassDesign(800, 1000, 400);
    setColumns(low, [[section({ mode: 'fixed', valueMm: 40 }), section()]]);
    const r3 = deriveModel(low);
    expect(!r3.ok && r3.issues.map((i) => i.code)).toEqual(['SECTION_TOO_LOW', 'TALL_FURNITURE_ANCHOR']);
  });

  it('AC-005: back thickness outside 3–8 mm', () => {
    expect(codes(model(carcassDesign(600, 720, 400, { back: 'mat-ply-9' })))).toEqual(['BACK_THICKNESS_OUT_OF_RANGE']);
    expect(codes(model(carcassDesign(600, 720, 400, { back: 'mat-ply-6' })))).toEqual([]);
  });

  it('AC-026: TALL_FURNITURE_ANCHOR from 750 mm', () => {
    expect(codes(model(carcassDesign(600, 749, 400)))).toEqual([]);
    expect(codes(model(carcassDesign(600, 750, 400)))).toEqual(['TALL_FURNITURE_ANCHOR']);
  });

  it('SHELF_SPAN_HEURISTIC above the material span (900 clear width)', () => {
    const doc = carcassDesign(936, 700, 450);
    setColumns(doc, [[section({ mode: 'auto' }, { interior: { kind: 'adjustableShelves', count: 2 } })]]);
    const m = model(doc);
    expect(m.issues).toEqual([
      expect.objectContaining({ code: 'SHELF_SPAN_HEURISTIC', severity: 'warning', params: { spanMm: 900, maxMm: 800 } }),
    ]);
    const ok = carcassDesign(800, 700, 450);
    setColumns(ok, [[section({ mode: 'auto' }, { interior: { kind: 'adjustableShelves', count: 2 } })]]);
    expect(codes(model(ok))).toEqual([]);
  });

  it('plinth rails and PLINTH_DIMENSION_INVALID', () => {
    const doc = carcassDesign(800, 900, 450);
    doc.carcass.base = { kind: 'plinth', heightMm: 100, setbackFrontMm: 50, setbackBackMm: 0, setbackSidesMm: 0 };
    const m = model(doc);
    expect(size(part(m, 'plinth:L'))).toEqual([400, 100, 18]);
    expect(size(part(m, 'plinth:F'))).toEqual([764, 100, 18]);
    expect(size(part(m, 'side:L'))).toEqual([800, 447, 18]);

    doc.carcass.base = { kind: 'plinth', heightMm: 40, setbackFrontMm: 350, setbackBackMm: 0, setbackSidesMm: 0 };
    const bad = model(doc);
    expect(bad.issues.filter((i) => i.code === 'PLINTH_DIMENSION_INVALID').map((i) => i.params.reason)).toEqual([
      'height',
      'depth',
    ]);
    expect(bad.parts.some((p) => p.role.startsWith('plinth'))).toBe(false);
  });

  it('DRAWER_INTERIOR_CONFLICT for drawers in a section with shelves', () => {
    const doc = carcassDesign(600, 720, 400);
    setColumns(doc, [
      [
        section(
          { mode: 'auto' },
          {
            interior: { kind: 'adjustableShelves', count: 1 },
            front: { kind: 'drawers', handleId: null, drawers: [{ id: 'd1', frontHeight: { mode: 'auto' } }] },
          },
        ),
      ],
    ]);
    expect(codes(model(doc))).toEqual(['DRAWER_INTERIOR_CONFLICT', 'HARDWARE_PROFILE_UNVERIFIED']);
  });

  it('REFERENCE_INVALID stops derivation', () => {
    const doc = template('blank');
    doc.carcass.materialIds.carcass = 'missing';
    const result = deriveModel(doc);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.issues.map((i) => i.code)).toEqual(['REFERENCE_INVALID']);
  });
});
