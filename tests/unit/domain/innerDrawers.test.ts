import { describe, expect, it } from 'vitest';
import { generateOutputs, INNER_DRAWER_DOOR_SETBACK_MM, setInterior, type DesignDocument } from '@/domain';
import { carcassDesign, codes, drawerSection, model, part, section, setColumns, template } from './fixtures';

/** 600 × 800 × 560 cabinet, one section with a door and two inner drawers. */
function innerDrawerDesign(front: 'door' | 'none' = 'door', count = 2): DesignDocument {
  const doc = carcassDesign(600, 800, 560);
  setColumns(doc, [
    [
      section(
        { mode: 'auto' },
        {
          id: 'sec-inner',
          interior: { kind: 'innerDrawers', count },
          front: front === 'door' ? { kind: 'door', hinge: 'left', handleId: 'h-bar-128' } : { kind: 'none' },
        },
      ),
    ],
  ]);
  return doc;
}

describe('inner drawers behind a door', () => {
  it('derives boxes without fronts, set back behind the hinges, owned by the section', () => {
    const doc = innerDrawerDesign();
    const m = model(doc);
    expect(m.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(m.parts.filter((p) => p.role === 'drawer-front')).toHaveLength(0);
    const boxParts = m.parts.filter((p) => p.role.startsWith('drawer-'));
    expect(boxParts).toHaveLength(10);
    expect(new Set(boxParts.map((p) => p.ownerId))).toEqual(new Set(['sec-inner']));

    const D = doc.carcass.depthMm;
    const sl = doc.hardware.slide;
    const Dc = m.layout.dims.Dc;
    const usable = Dc - sl.rearClearanceMm - sl.frontSetbackMm - INNER_DRAWER_DOOR_SETBACK_MM;
    const Ls = [...sl.lengthsMm].reverse().find((l) => l <= usable);
    const side = part(m, 'drw:sec-inner.inner1:sideL');
    expect(side.box.max[2]).toBe(D - INNER_DRAWER_DOOR_SETBACK_MM);
    expect(side.box.max[2] - side.box.min[2]).toBe(Ls);

    // Both boxes share the clear height evenly.
    const rs = m.layout.columns[0]!.sections[0]!;
    const bottom2 = part(m, 'drw:sec-inner.inner2:bottom');
    expect(bottom2.box.min[1]).toBeCloseTo(rs.y0 + rs.heightMm / 2 + doc.construction.drawerBoxClearanceBelowMm, 5);

    // Cabinet slide holes lie behind the set-back box front; no front screws, no drawer handle holes.
    const cabinetHoles = m.holes.filter((h) => h.purpose === 'slide-cabinet');
    expect(cabinetHoles.length).toBeGreaterThan(0);
    const sideL = part(m, 'side:L');
    const zOf = (h: { uMm: number; vMm: number }) => sideL.box.min[2] + (sideL.frame.u === 'z' ? h.uMm : h.vMm);
    for (const h of cabinetHoles.filter((x) => x.partId === sideL.id)) {
      expect(zOf(h)).toBeLessThanOrEqual(D - INNER_DRAWER_DOOR_SETBACK_MM - sl.frontSetbackMm + 1e-6);
    }
    expect(m.holes.some((h) => h.purpose === 'front-attach')).toBe(false);
    expect(m.holes.filter((h) => h.purpose === 'handle').every((h) => part(m, h.partId).role === 'door')).toBe(true);

    const hardware = generateOutputs(doc, m).hardware;
    expect(hardware.find((r) => r.key === `slide:${String(Ls)}`)?.quantity).toBe(2);
    expect(hardware.some((r) => r.key === 'screw:frontScrew')).toBe(false);
  });

  it('without a door the boxes start at the front edge', () => {
    const doc = innerDrawerDesign('none');
    const m = model(doc);
    expect(part(m, 'drw:sec-inner.inner1:sideL').box.max[2]).toBe(doc.carcass.depthMm);
  });

  it('too many drawers for the section height report DRAWER_BOX_TOO_LOW on the section interior', () => {
    const doc = carcassDesign(600, 400, 560);
    setColumns(doc, [[section({ mode: 'auto' }, { id: 'sec-low', interior: { kind: 'innerDrawers', count: 6 } })]]);
    const m = model(doc);
    const low = m.issues.find((i) => i.code === 'DRAWER_BOX_TOO_LOW');
    expect(low?.target).toEqual({ kind: 'section', id: 'sec-low', field: 'interior' });
    expect(m.parts.some((p) => p.role.startsWith('drawer-'))).toBe(false);
  });

  it('a too shallow carcass reports DRAWER_DEPTH_NO_SLIDE', () => {
    const doc = carcassDesign(600, 800, 300);
    setColumns(doc, [[section({ mode: 'auto' }, { interior: { kind: 'innerDrawers', count: 2 }, front: { kind: 'door', hinge: 'left', handleId: null } })]]);
    expect(codes(model(doc))).toContain('DRAWER_DEPTH_NO_SLIDE');
  });

  it('assembly: one drawer step without front texts; slides marked unverified until checked', () => {
    const doc = innerDrawerDesign();
    const m = model(doc);
    const step = generateOutputs(doc, m).steps.find((s) => s.phase === 'P10');
    expect(step?.title).toEqual({ key: 'step.drawers.title', params: { count: 2 } });
    expect(step?.body.map((b) => b.key)).not.toContain('step.drawers.fronts');
    expect(m.issues.some((i) => i.code === 'HARDWARE_PROFILE_UNVERIFIED' && i.params.profile === 'slide')).toBe(true);
  });

  it('a section with drawer fronts cannot get inner drawers', () => {
    const doc = carcassDesign(600, 800, 560);
    setColumns(doc, [[drawerSection(['d1', 'd2'], { id: 'sec-front' })]]);
    const result = setInterior(doc, { sectionId: 'sec-front', interior: { kind: 'innerDrawers', count: 2 } });
    expect(result).toEqual({ ok: false, reason: 'drawers-present' });
  });
});

describe('clothes rail geometry (3D)', () => {
  it('the wardrobe model contains the rail tube between the end allowances, 60 mm below the panel above', () => {
    const doc = template('wardrobe');
    const m = model(doc);
    expect(m.rails).toHaveLength(1);
    const rail = m.rails[0]!;
    const column = m.layout.columns[0]!;
    const rs = column.sections[0]!;
    const r = doc.hardware.clothesRail;
    expect(rail.x1 - rail.x0).toBe(column.widthMm - 2 * r.endAllowanceMm);
    expect(rail.y).toBe(rs.y1 - r.centerBelowTopMm);
    expect(rail.diameterMm).toBe(r.tubeDiameterMm);
    const lengths = generateOutputs(doc, m).hardware.filter((h) => h.kind === 'rail').map((h) => h.key);
    expect(lengths).toEqual([`rail:${String(rail.x1 - rail.x0)}`]);
  });

  it('choosing a rail adds a tube; removing it removes the tube', () => {
    const doc = carcassDesign(600, 2000, 600);
    setColumns(doc, [[section({ mode: 'auto' }, { id: 'sec-rail', interior: { kind: 'clothesRail' } })]]);
    expect(model(doc).rails.map((r) => r.sectionId)).toEqual(['sec-rail']);
    doc.layout.columns[0]!.sections[0]!.interior = { kind: 'empty' };
    expect(model(doc).rails).toEqual([]);
  });
});
