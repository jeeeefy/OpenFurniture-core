import { describe, expect, it } from 'vitest';
import { createDesign, generateOutputs, TEMPLATE_IDS, type DesignDocument } from '@/domain';
import { counterIds, NOW } from '../helpers';
import { cabinetDesign, carcassDesign, codes, drawerSection, model, section, setColumns } from './fixtures';

const outputsOf = (doc: DesignDocument) => {
  const m = model(doc);
  return { m, out: generateOutputs(doc, m) };
};

describe('drilling plans (T-019)', () => {
  it.each(TEMPLATE_IDS)('AC-031: %s – every hole of each position appears exactly once, inside the face', (id) => {
    const doc = createDesign(id, counterIds(), NOW, id);
    const { m, out } = outputsOf(doc);
    for (const group of out.positions) {
      const partId = group.partIds[0]!;
      const holes = m.holes.filter((h) => h.partId === partId);
      const marks = m.marks.filter((mk) => mk.partId === partId);
      const plan = out.drillingPlans.find((p) => p.position === group.position);
      if (holes.length === 0 && marks.length === 0) {
        expect(plan).toBeUndefined();
        continue;
      }
      expect(plan, `position ${group.position}`).toBeDefined();
      expect(plan!.quantity).toBe(group.quantity);
      for (const face of ['A', 'B'] as const) {
        const planFace = plan!.faces.find((f) => f.face === face);
        expect(planFace?.holes.length ?? 0).toBe(holes.filter((h) => h.face === face).length);
        expect(planFace?.marks.length ?? 0).toBe(marks.filter((mk) => mk.face === face).length);
        for (const h of planFace?.holes ?? []) {
          const r = (h.countersinkDiameterMm ?? h.diameterMm) / 2;
          expect(h.xMm - r, `${partId} ${h.ref}`).toBeGreaterThanOrEqual(0);
          expect(h.xMm + r, `${partId} ${h.ref}`).toBeLessThanOrEqual(plan!.lengthMm);
          expect(h.yMm - r, `${partId} ${h.ref}`).toBeGreaterThanOrEqual(0);
          expect(h.yMm + r, `${partId} ${h.ref}`).toBeLessThanOrEqual(plan!.widthMm);
        }
        const refs = planFace?.holes.map((h) => h.ref) ?? [];
        expect(new Set(refs).size).toBe(refs.length);
      }
    }
    expect(codes(m).filter((c) => c.startsWith('HOLE_'))).toEqual([]);
  });

  it('face B views are mirrored (x = length − u); refs run H1… by x then y', () => {
    const { m, out } = outputsOf(carcassDesign(800, 2000, 400, { back: 'mat-ply-6' }));
    const plan = out.drillingPlans.find((p) => p.role === 'side-left')!;
    const face = plan.faces.find((f) => f.face === 'B')!;
    expect(face.semantic).toBe('outer');
    expect(face.edgeNames).toEqual({ u0: 'bottom', u1: 'top', v0: 'back', v1: 'front' });
    const raw = m.holes.filter((h) => h.partId === 'side:L');
    expect(face.holes.map((h) => h.xMm).sort((a, b) => a - b)).toEqual(raw.map((h) => 2000 - h.uMm).sort((a, b) => a - b));
    expect(face.holes[0]).toMatchObject({ ref: 'H1', xMm: 9, yMm: 40, diameterMm: 4.5, depth: 'through', countersinkDiameterMm: 8.5 });
    const sideR = out.drillingPlans.find((p) => p.role === 'side-right')!;
    expect(sideR.faces.map((f) => [f.face, f.semantic])).toEqual([['A', 'outer']]);
    expect(sideR.faces[0]!.holes[0]?.xMm).toBe(9);
  });

  it('back panel plans show nail marks', () => {
    const { out } = outputsOf(carcassDesign(800, 2000, 400, { back: 'mat-ply-6' }));
    const back = out.drillingPlans.find((p) => p.role === 'back')!;
    expect(back.faces).toHaveLength(1);
    expect(back.faces[0]).toMatchObject({ face: 'B', semantic: 'rear-face', holes: [] });
    expect(back.faces[0]!.marks).toHaveLength(60);
    expect(back.faces[0]!.marks[0]?.ref).toBe('M1');
  });

  it('AC-032 (domain): unverified profile holes flag the plan; pilot holes in mating edges are not drawn', () => {
    const doc = cabinetDesign();
    const { out } = outputsOf(doc);
    const door = out.drillingPlans.find((p) => p.role === 'door')!;
    expect(door.unverifiedProfiles).toEqual(['Bar handle 128 mm', 'Concealed cup hinge 35 mm (generic)']);
    expect(door.faces.map((f) => f.face)).toEqual(['A', 'B']);
    expect(out.drillingPlans.find((p) => p.role === 'side-left')!.unverifiedProfiles).toEqual(['Concealed cup hinge 35 mm (generic)']);
    // Top and bottom only receive screw tips (pilot holes drilled during assembly): no plan.
    expect(out.drillingPlans.find((p) => p.role === 'top')).toBeUndefined();

    doc.hardware.hinge.verifiedByUser = true;
    doc.hardware.handles[0]!.verifiedByUser = true;
    expect(outputsOf(doc).out.drillingPlans.every((p) => p.unverifiedProfiles.length === 0)).toBe(true);
  });
});

describe('hole checks (T-019)', () => {
  it('drawers at equal heights on both sides of a divider offset the slides instead of conflicting', () => {
    const doc = carcassDesign(1000, 720, 450);
    setColumns(doc, [[drawerSection(['l1', 'l2'])], [drawerSection(['r1', 'r2'])]]);
    const m = model(doc);
    expect(codes(m).filter((c) => c.startsWith('HOLE_'))).toEqual([]);
    const slideHoles = m.holes.filter((h) => h.partId === 'divider:col-1' && h.purpose === 'slide-cabinet');
    const heights = (face: 'A' | 'B') => [...new Set(slideHoles.filter((h) => h.face === face).map((h) => h.uMm))].sort((x, y) => x - y);
    expect(heights('A').length).toBeGreaterThan(0);
    expect(heights('A')).not.toEqual(heights('B'));
  });

  it('offset drawer stacks do not conflict', () => {
    const doc = carcassDesign(1000, 720, 450);
    setColumns(doc, [[drawerSection(['l1', 'l2'])], [drawerSection(['r1', 'r2', 'r3'])]]);
    expect(codes(model(doc))).not.toContain('HOLE_CONFLICT');
  });

  it('HOLE_TOO_CLOSE_TO_EDGE when pin rows move to the panel edge', () => {
    const doc = carcassDesign(600, 720, 400);
    setColumns(doc, [[section({ mode: 'auto' }, { interior: { kind: 'adjustableShelves', count: 1 } })]]);
    doc.hardware.shelfPin.rowSetbackMm = 3;
    const issue = model(doc).issues.find((i) => i.code === 'HOLE_TOO_CLOSE_TO_EDGE');
    expect(issue).toMatchObject({ severity: 'error', target: { kind: 'part', id: 'side:L' } });
    expect(issue?.params.minMm).toBe(2);
  });

  it('cup bores use min(minHoleEdgeMaterial, TB) at the hinge edge', () => {
    const doc = cabinetDesign();
    doc.hardware.hinge.cupEdgeDistanceMm = 1;
    expect(codes(model(doc))).not.toContain('HOLE_TOO_CLOSE_TO_EDGE');
    doc.construction.minHoleEdgeMaterialMm = 1;
    doc.hardware.hinge.cupEdgeDistanceMm = 0.5;
    expect(codes(model(doc))).not.toContain('HOLE_TOO_CLOSE_TO_EDGE');
  });
});
