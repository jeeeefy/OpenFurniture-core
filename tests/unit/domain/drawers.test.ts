import { describe, expect, it } from 'vitest';
import { generateOutputs, type DesignDocument, type FurnitureModel } from '@/domain';
import { carcassDesign, chestDesign, codes, drawerSection, model, part, section, setColumns, sideboardDesign, size } from './fixtures';

const hw = (m: FurnitureModel, doc: DesignDocument, key: string) =>
  generateOutputs(doc, m).hardware.find((row) => row.key === key);
const boxHeight = (m: FurnitureModel, drawerId: string) => {
  const bottom = part(m, `drw:${drawerId}:bottom`);
  return part(m, `drw:${drawerId}:sideL`).box.max[1] - bottom.box.min[1];
};

describe('drawers and slides (T-017)', () => {
  it('CON-005 / AC-015: sideboard drawer column', () => {
    const doc = sideboardDesign();
    const m = model(doc);
    expect(m.layout.columns.map((c) => c.widthMm)).toEqual([510, 509, 509]);
    expect(['sb-d1', 'sb-d2', 'sb-d3'].map((id) => boxHeight(m, id))).toEqual([185, 203, 185]);
    for (const id of ['sb-d1', 'sb-d2', 'sb-d3']) expect(size(part(m, `drw:${id}:front`))).toEqual([524, 230, 18]);
    expect(size(part(m, 'drw:sb-d1:sideL'))).toEqual([400, 176, 15]);
    expect(size(part(m, 'drw:sb-d1:inFront'))).toEqual([453.6, 176, 15]);
    expect(size(part(m, 'drw:sb-d1:inBack'))).toEqual([453.6, 176, 15]);
    expect(size(part(m, 'drw:sb-d1:bottom'))).toEqual([483.6, 400, 9]);
    expect(hw(m, doc, 'slide:400')).toMatchObject({ quantity: 3, unit: 'pairs', spareIncluded: 0 });
  });

  it('CON-013 / AC-018: chest – 4 slide pairs, 24 drawer parts, box heights and width', () => {
    const doc = chestDesign();
    const m = model(doc);
    expect(m.parts.filter((p) => p.id.startsWith('drw:'))).toHaveLength(24);
    expect(['ch-d1', 'ch-d2', 'ch-d3', 'ch-d4'].map((id) => boxHeight(m, id))).toEqual([177, 195, 195, 176]);
    expect(part(m, 'drw:ch-d1:bottom').lengthMm).toBe(738.6);
    expect(hw(m, doc, 'slide:400')?.quantity).toBe(4);
    for (const role of ['drawer-front', 'drawer-side', 'drawer-inner-front', 'drawer-inner-back', 'drawer-bottom'] as const) {
      expect(m.parts.filter((p) => p.role === role)).toHaveLength(role === 'drawer-side' ? 8 : 4);
    }
    expect(codes(m)).toEqual(['HARDWARE_PROFILE_UNVERIFIED', 'HARDWARE_PROFILE_UNVERIFIED', 'TALL_FURNITURE_ANCHOR']);
  });

  it('slide holes: cabinet members on both boundary faces, drawer members on the outer faces', () => {
    const m = model(chestDesign());
    const cabinet = m.holes.filter((h) => h.purpose === 'slide-cabinet');
    // Offsets ≤ 400 − 20: 37, 165, 293 → 3 per face and drawer.
    expect(cabinet.filter((h) => h.partId === 'side:L')).toHaveLength(12);
    expect(cabinet.filter((h) => h.partId === 'side:L').every((h) => h.face === 'A')).toBe(true);
    expect(cabinet.filter((h) => h.partId === 'side:R').every((h) => h.face === 'B')).toBe(true);
    expect([...new Set(cabinet.map((h) => h.vMm))].sort((a, b) => a - b)).toEqual([447 - 2 - 293, 447 - 2 - 165, 447 - 2 - 37]);
    const drawerHoles = m.holes.filter((h) => h.partId === 'drw:ch-d1:sideL' && h.purpose === 'slide-drawer');
    expect(drawerHoles.map((h) => [h.face, h.uMm, h.vMm])).toEqual([
      ['B', 400 - 2 - 293, 84],
      ['B', 400 - 2 - 165, 84],
      ['B', 400 - 2 - 37, 84],
    ]);
    expect(m.holes.filter((h) => h.partId === 'drw:ch-d1:sideR' && h.purpose === 'slide-drawer').every((h) => h.face === 'A')).toBe(true);
  });

  it('drawer box joints: sides into inner front/back, bottom from below', () => {
    const doc = chestDesign();
    const m = model(doc);
    const side = m.holes.filter((h) => h.partId === 'drw:ch-d1:sideL' && h.purpose === 'drawer-box-screw');
    expect(side.every((h) => h.face === 'B')).toBe(true);
    expect(side.length).toBeGreaterThanOrEqual(4);
    const bottom = m.holes.filter((h) => h.partId === 'drw:ch-d1:bottom');
    expect(bottom.every((h) => h.face === 'B' && h.purpose === 'drawer-bottom-screw')).toBe(true);
    expect(m.joints.filter((j) => j.kind === 'screw-butt' && j.facePartId.startsWith('drw:ch-d1:'))).toHaveLength(8);
  });

  it('AC-016: no slide fits → DRAWER_DEPTH_NO_SLIDE; low boxes → DRAWER_BOX_TOO_LOW', () => {
    const shallow = carcassDesign(600, 720, 250);
    setColumns(shallow, [[drawerSection(['s1'])]]);
    const m1 = model(shallow);
    expect(m1.issues).toContainEqual(expect.objectContaining({ code: 'DRAWER_DEPTH_NO_SLIDE', severity: 'error' }));
    expect(m1.parts.filter((p) => p.id.startsWith('drw:s1:'))).toEqual([expect.objectContaining({ id: 'drw:s1:front' })]);

    const low = carcassDesign(600, 400, 450);
    setColumns(low, [[drawerSection(['l1', 'l2', 'l3', 'l4', 'l5', 'l6'])]]);
    const lowIssues = model(low).issues.filter((i) => i.code === 'DRAWER_BOX_TOO_LOW');
    expect(lowIssues).toHaveLength(6);
    expect(lowIssues[0]?.target).toEqual({ kind: 'drawer', id: 'l1', field: 'frontHeight' });
  });

  it('DRAWER_FRONTS_DONT_FIT and DRAWER_BOX_TOO_NARROW', () => {
    const doc = carcassDesign(600, 720, 450);
    setColumns(doc, [[drawerSection(['a', 'b'])]]);
    const front = doc.layout.columns[0]!.sections[0]!.front;
    if (front.kind === 'drawers') front.drawers.forEach((d) => (d.frontHeight = { mode: 'fixed', valueMm: 300 }));
    expect(codes(model(doc))).toContain('DRAWER_FRONTS_DONT_FIT');

    const narrow = carcassDesign(800, 720, 450);
    setColumns(narrow, [[drawerSection(['n'])], [section()]], [{ mode: 'fixed', valueMm: 100 }, { mode: 'auto' }]);
    expect(codes(model(narrow))).toEqual(expect.arrayContaining(['DRAWER_BOX_TOO_NARROW', 'NARROW_COMPARTMENT_TOOL_ACCESS']));
  });

  it('fixed front heights are respected, auto fronts share the rest', () => {
    const doc = chestDesign();
    const front = doc.layout.columns[0]!.sections[0]!.front;
    if (front.kind === 'drawers') front.drawers[0]!.frontHeight = { mode: 'fixed', valueMm: 300 };
    const m = model(doc);
    expect(part(m, 'drw:ch-d1:front').widthMm).toBe(300);
    // 896 − 3 gaps − 300 = 587 mm → distribute: 196, 196, 195.
    expect(['ch-d2', 'ch-d3', 'ch-d4'].map((id) => part(m, `drw:${id}:front`).widthMm)).toEqual([196, 196, 195]);
  });

  it('profile edits: side clearance, slide lengths, rear clearance and clearances above/below', () => {
    const doc = chestDesign();
    doc.hardware.slide.sideClearanceMm = 13;
    doc.hardware.slide.lengthsMm = [300, 350];
    doc.construction.drawerBoxClearanceAboveMm = 30;
    const m = model(doc);
    expect(part(m, 'drw:ch-d1:bottom').lengthMm).toBe(738);
    expect(hw(m, doc, 'slide:350')?.quantity).toBe(4);
    expect(boxHeight(m, 'ch-d2')).toBe(185);
    doc.hardware.slide.rearClearanceMm = 100;
    expect(hw(model(doc), doc, 'slide:300')?.quantity).toBe(4);
  });

  it('AC-017 (domain): imported drawers with shelves give DRAWER_INTERIOR_CONFLICT', () => {
    const doc = carcassDesign(600, 720, 450);
    setColumns(doc, [[drawerSection(['x'], { interior: { kind: 'adjustableShelves', count: 1 } })]]);
    expect(codes(model(doc))).toContain('DRAWER_INTERIOR_CONFLICT');
  });
});
