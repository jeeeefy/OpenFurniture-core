import { describe, expect, it } from 'vitest';
import { generateOutputs, type DesignDocument, type FurnitureModel } from '@/domain';
import { frontZone } from '@/domain/layout/frontGrid';
import { hingePositions } from '@/domain/rules/hinges';
import { cabinetDesign, carcassDesign, codes, model, part, section, setColumns, size } from './fixtures';

const hw = (m: FurnitureModel, doc: DesignDocument, key: string) =>
  generateOutputs(doc, m).hardware.find((row) => row.key === key);

function singleDoor(width: number, height: number, hinge: 'left' | 'right' = 'left'): DesignDocument {
  const doc = carcassDesign(width, height, 450);
  setColumns(doc, [[section({ mode: 'auto' }, { front: { kind: 'door', hinge, handleId: null } })]]);
  return doc;
}

describe('front grid (T-016)', () => {
  it('outer edges use the reveal; shared dividers use half overlay with the gap', () => {
    const doc = carcassDesign(800, 720, 400);
    setColumns(doc, [
      [section({ mode: 'auto' }, { front: { kind: 'door', hinge: 'left', handleId: null } })],
      [section({ mode: 'auto' }, { front: { kind: 'door', hinge: 'right', handleId: null } })],
    ]);
    const m = model(doc);
    const left = frontZone(doc, m.layout, m.layout.dims, 0, 0);
    expect(left).toEqual({ xL: 2, xR: 400 - 1.5, yB: 2, yT: 718, edges: { left: 'outer', right: 'half', bottom: 'outer', top: 'outer' } });
    const right = frontZone(doc, m.layout, m.layout.dims, 1, 0);
    expect(right?.xL).toBe(401.5);
    expect(right?.edges.left).toBe('half');
  });

  it('a divider without a neighbouring front gives full overlay to its far face', () => {
    const doc = carcassDesign(800, 720, 400);
    setColumns(doc, [[section({ mode: 'auto' }, { front: { kind: 'door', hinge: 'left', handleId: null } })], [section()]]);
    const m = model(doc);
    expect(frontZone(doc, m.layout, m.layout.dims, 0, 0)).toMatchObject({ xR: 409 - 2, edges: { right: 'full' } });
  });

  it('fixed shelves between two fronts split at the shelf centre', () => {
    const doc = carcassDesign(600, 1000, 400);
    const door = { kind: 'door' as const, hinge: 'left' as const, handleId: null };
    setColumns(doc, [[section({ mode: 'fixed', valueMm: 400 }, { front: door }), section({ mode: 'auto' }, { front: door })]]);
    const m = model(doc);
    const lower = frontZone(doc, m.layout, m.layout.dims, 0, 0);
    const upper = frontZone(doc, m.layout, m.layout.dims, 0, 1);
    expect(lower).toMatchObject({ yT: 18 + 400 + 9 - 1.5, edges: { top: 'half' } });
    expect(upper).toMatchObject({ yB: 18 + 400 + 9 + 1.5, edges: { bottom: 'half' } });
  });
});

describe('doors and hinges (T-016)', () => {
  it('CON-004 / AC-011: cabinet double door, hinges, cup bores and plate holes', () => {
    const doc = cabinetDesign();
    const m = model(doc);
    const leafL = part(m, `door:${doc.layout.columns[0]!.sections[0]!.id}:L`);
    const leafR = part(m, `door:${doc.layout.columns[0]!.sections[0]!.id}:R`);
    expect(size(leafL)).toEqual([796, 396.5, 18]);
    expect(size(leafR)).toEqual([796, 396.5, 18]);
    expect(leafL.bandedEdges).toEqual(['u0', 'u1', 'v0', 'v1']);

    const cups = m.holes.filter((h) => h.purpose === 'hinge-cup');
    expect(cups).toHaveLength(4);
    const cupL = cups.filter((h) => h.partId === leafL.id);
    expect(cupL.map((h) => h.uMm + 102)).toEqual([202, 798]);
    expect(cupL.every((h) => h.vMm === 21.5 && h.face === 'B' && h.diameterMm === 35 && h.depthMm === 13)).toBe(true);
    expect(cups.filter((h) => h.partId === leafR.id).every((h) => h.vMm === 396.5 - 21.5)).toBe(true);

    for (const [side, face] of [
      ['side:L', 'A'],
      ['side:R', 'B'],
    ] as const) {
      const plates = m.holes.filter((h) => h.partId === side && h.purpose === 'hinge-plate');
      expect(plates.every((h) => h.face === face && h.vMm + 3 === 413)).toBe(true);
      // Side local u starts at the plinth height 100.
      expect(plates.map((h) => h.uMm + 100)).toEqual([186, 218, 782, 814]);
    }
    expect(hw(m, doc, 'hinge:full')).toMatchObject({ quantity: 4, spareIncluded: 0, verified: false });
    expect(hw(m, doc, 'hinge-plate')?.quantity).toBe(4);
    expect(hw(m, doc, 'hinge-screw')).toMatchObject({ quantity: Math.ceil((4 * 2 + 8) * 1.1) });
  });

  it('CON-008: cabinet shelf pins – 88 candidates, 4 suppressed next to the plate holes, 8 pins → 9', () => {
    const doc = cabinetDesign();
    const m = model(doc);
    const pins = m.holes.filter((h) => h.purpose === 'shelf-pin');
    expect(pins).toHaveLength(84);
    // Front pin row: z = D − 37 = 413, local v = z − tB = 410.
    const front = (side: string) => pins.filter((h) => h.partId === side && h.vMm === 410).map((h) => h.uMm + 100);
    for (const side of ['side:L', 'side:R']) {
      expect(front(side)).not.toContain(190);
      expect(front(side)).not.toContain(222);
      expect(front(side)).toContain(158);
    }
    expect(hw(m, doc, 'shelf-pin')).toMatchObject({ quantity: 9 });
  });

  it('adjustable shelves behind a door use the door front setback', () => {
    const m = model(cabinetDesign());
    expect(m.parts.filter((p) => p.role === 'adjustable-shelf').map((p) => p.widthMm)).toEqual([447 - 22, 447 - 22]);
  });

  it('AC-012: hinge count by door height', () => {
    expect(hingePositions(0, 800, 3, 100)).toEqual([100, 400, 700]);
    const count = (height: number) => model(singleDoor(500, height)).holes.filter((h) => h.purpose === 'hinge-cup').length;
    expect(count(900 + 4)).toBe(2);
    expect(count(901 + 4)).toBe(3);
    expect(count(1600 + 4)).toBe(3);
    expect(count(2000 + 4)).toBe(4);
    expect(count(2400 + 4)).toBe(5);
  });

  it('AC-012: too short and too tall doors', () => {
    expect(codes(model(singleDoor(500, 235)))).toContain('DOOR_TOO_SHORT_FOR_HINGES');
    expect(codes(model(singleDoor(500, 236)))).not.toContain('DOOR_TOO_SHORT_FOR_HINGES');
    expect(codes(model(singleDoor(500, 2405)))).toContain('DOOR_TOO_TALL');
  });

  it('door width checks: DOOR_TOO_NARROW (error) and DOOR_WIDE (warning)', () => {
    const narrowDoc = carcassDesign(300, 720, 450);
    setColumns(narrowDoc, [[section({ mode: 'auto' }, { front: { kind: 'doubleDoor', handleId: null } })]]);
    // (296 − 3) / 2 = 146.5 < 150
    const narrow = model(narrowDoc);
    expect(narrow.issues).toContainEqual(expect.objectContaining({ code: 'DOOR_TOO_NARROW', severity: 'error' }));
    const wide = model(singleDoor(700, 720));
    expect(wide.issues).toContainEqual(expect.objectContaining({ code: 'DOOR_WIDE', severity: 'warning' }));
  });

  it('AC-013: an overlay outside the profile range is an error; half overlay next to a neighbouring door', () => {
    const doc = singleDoor(500, 720);
    doc.hardware.hinge.overlayRangesMm.full = [10, 12];
    const overlayIssue = model(doc).issues.find((i) => i.code === 'HINGE_OVERLAY_UNSUPPORTED');
    expect(overlayIssue?.severity).toBe('error');
    expect(overlayIssue?.params.overlayMm).toBe(16);

    const pair = carcassDesign(800, 720, 400);
    setColumns(pair, [
      [section({ mode: 'auto' }, { front: { kind: 'door', hinge: 'right', handleId: null } })],
      [section({ mode: 'auto' }, { front: { kind: 'door', hinge: 'left', handleId: null } })],
    ]);
    const m = model(pair);
    expect(codes(m)).not.toContain('HINGE_OVERLAY_UNSUPPORTED');
    expect(hw(m, pair, 'hinge:half')?.quantity).toBe(4);
    pair.hardware.hinge.overlayRangesMm.half = [8, 10];
    expect(codes(model(pair))).toContain('HINGE_OVERLAY_UNSUPPORTED');
  });

  it('AC-023 (hinge): an unverified hinge warns once; marking it verified removes the warning', () => {
    const doc = cabinetDesign();
    doc.hardware.handles[0]!.verifiedByUser = true;
    const warnings = model(doc).issues.filter((i) => i.code === 'HARDWARE_PROFILE_UNVERIFIED');
    expect(warnings).toEqual([expect.objectContaining({ target: { kind: 'profile', id: 'hinge-generic-35', field: 'verifiedByUser' } })]);
    doc.hardware.hinge.verifiedByUser = true;
    expect(codes(model(doc))).not.toContain('HARDWARE_PROFILE_UNVERIFIED');
  });

  it('profile edits: edge offset, cup distance and plate setback move the holes', () => {
    const doc = cabinetDesign();
    Object.assign(doc.hardware.hinge, { edgeOffsetMm: 120, cupEdgeDistanceMm: 5 });
    doc.hardware.hinge.plate.setbackFromFrontMm = 40;
    const m = model(doc);
    const cup = m.holes.find((h) => h.purpose === 'hinge-cup');
    expect(cup).toMatchObject({ uMm: 120, vMm: 22.5 });
    expect(m.holes.find((h) => h.purpose === 'hinge-plate')?.vMm).toBe(450 - 40 - 3);
  });

  it('cup fixing holes from the profile are placed relative to the cup centre, inward from the hinge edge', () => {
    const doc = singleDoor(500, 720, 'right');
    doc.hardware.hinge.cupFixingHoles = [{ offsetAlongMm: 24, offsetInwardMm: 9.5, diameterMm: 2.5, depthMm: 10 }];
    const m = model(doc);
    const cup = m.holes.find((h) => h.purpose === 'hinge-cup')!;
    const fix = m.holes.find((h) => h.purpose === 'hinge-cup-fixing')!;
    expect(fix.uMm - cup.uMm).toBe(24);
    expect(cup.vMm - fix.vMm).toBe(9.5);
  });
});
