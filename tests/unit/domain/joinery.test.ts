import { describe, expect, it } from 'vitest';
import { generateOutputs, type DesignDocument, type FurnitureModel, type Hole } from '@/domain';
import { screwPositions } from '@/domain/rules/common';
import { carcassDesign, codes, model, part, section, setColumns, size, template } from './fixtures';

const hw = (m: FurnitureModel, doc: DesignDocument, key: string) =>
  generateOutputs(doc, m).hardware.find((row) => row.key === key);
const holesOf = (m: FurnitureModel, partId: string, purpose?: Hole['purpose']) =>
  m.holes.filter((h) => h.partId === partId && (!purpose || h.purpose === purpose));

function plinthCabinet(): DesignDocument {
  const doc = carcassDesign(800, 900, 450);
  doc.carcass.base = { kind: 'plinth', heightMm: 100, setbackFrontMm: 50, setbackBackMm: 0, setbackSidesMm: 0 };
  return doc;
}

describe('screw joints (T-014)', () => {
  it('CON-006: a 394 mm joint gets screws at 40, 144.7, 249.3, 354', () => {
    expect(screwPositions(394, 40, 150).map((p) => Math.round(p * 10) / 10)).toEqual([40, 144.7, 249.3, 354]);
    const m = model(carcassDesign(800, 2000, 400, { back: 'mat-ply-6' }));
    const sideHoles = holesOf(m, 'side:L', 'carcass-screw');
    expect(sideHoles).toHaveLength(8);
    expect(sideHoles.filter((h) => h.uMm === 1991).map((h) => h.vMm)).toEqual([40, 144.7, 249.3, 354]);
  });

  it('holes sit on the face part with clearance, through and countersink away from the joint', () => {
    const m = model(template('bookcase'));
    const [hole] = holesOf(m, 'side:L', 'carcass-screw');
    expect(hole).toMatchObject({ face: 'B', diameterMm: 4.5, depthMm: 'through', countersinkDiameterMm: 8.5, profileKey: null });
    expect(holesOf(m, 'side:R', 'carcass-screw').every((h) => h.face === 'A')).toBe(true);
    expect(holesOf(m, 'top').every((h) => h.face === 'A')).toBe(true);
    expect(holesOf(m, 'bottom').every((h) => h.face === 'B')).toBe(true);
    const col1 = m.layout.columns[0]!.id;
    // Column 1's fixed shelves sit on the divider's left: screws are countersunk on its right face A.
    expect(holesOf(m, `divider:${col1}`, 'carcass-screw').every((h) => h.face === 'A')).toBe(true);
    // Dc 297 → 3 screws per shelf, 4 shelves.
    expect(holesOf(m, `divider:${col1}`, 'carcass-screw')).toHaveLength(12);
  });

  it('hole ids follow <partId>#<purpose>#<n>, numbered by face, u and v', () => {
    const m = model(template('blank'));
    const ids = holesOf(m, 'side:L').map((h) => h.id);
    expect(ids[0]).toBe('side:L#carcass-screw#1');
    const sorted = holesOf(m, 'side:L');
    for (let i = 1; i < sorted.length; i += 1) {
      const a = sorted[i - 1]!;
      const b = sorted[i]!;
      expect(a.uMm < b.uMm || (a.uMm === b.uMm && a.vMm < b.vMm)).toBe(true);
    }
  });

  it('glue counts every screw-butt joint', () => {
    const doc = template('blank');
    const m = model(doc);
    expect(m.joints).toHaveLength(4);
    expect(hw(m, doc, 'glue')).toMatchObject({ quantity: 4, label: { key: 'hardware.glue', params: { joints: 4 } } });
  });
});

describe('back fasteners (T-014)', () => {
  it('CON-007: nails give 60 marks on face B and 66 incl. spare', () => {
    const doc = carcassDesign(800, 2000, 400, { back: 'mat-ply-6' });
    const m = model(doc);
    const marks = m.marks.filter((mk) => mk.purpose === 'back-nail');
    expect(marks).toHaveLength(60);
    expect(marks.every((mk) => mk.partId === 'back' && mk.face === 'B')).toBe(true);
    expect(hw(m, doc, 'back:nail')).toMatchObject({ quantity: 66, spareIncluded: 6 });
  });

  it('screwed backs get countersunk clearance holes instead of marks', () => {
    const doc = carcassDesign(800, 2000, 400, { back: 'mat-ply-6' });
    doc.carcass.back.fastener = 'screw';
    const m = model(doc);
    expect(m.marks).toHaveLength(0);
    expect(holesOf(m, 'back', 'back-screw')).toHaveLength(60);
    expect(holesOf(m, 'back', 'back-screw')[0]).toMatchObject({ face: 'B', diameterMm: 3.5, countersinkDiameterMm: 6.5 });
    expect(hw(m, doc, 'screw:backScrew')?.quantity).toBe(66);
  });

  it('dividers and fixed shelves add fastener lines', () => {
    const plain = model(carcassDesign(800, 2000, 400));
    const doc = carcassDesign(800, 2000, 400);
    setColumns(doc, [[section(), section()], [section()]]);
    expect(model(doc).marks.length).toBeGreaterThan(plain.marks.length);
  });
});

describe('shelf pins (T-014)', () => {
  it('AC-009: two rows 37 from front and back, pitch 32, margin 40, Ø5 × 10', () => {
    const doc = carcassDesign(600, 720, 400);
    setColumns(doc, [[section({ mode: 'auto' }, { interior: { kind: 'adjustableShelves', count: 2 } })]]);
    const m = model(doc);
    const pins = holesOf(m, 'side:L', 'shelf-pin');
    expect(pins.every((h) => h.face === 'A' && h.diameterMm === 5 && h.depthMm === 10 && h.profileKey === 'shelfPin')).toBe(true);
    expect([...new Set(pins.map((h) => h.vMm))]).toEqual([37, 397 - 37]);
    const heights = [...new Set(pins.map((h) => h.uMm))];
    expect(heights[0]).toBe(18 + 40);
    expect(heights[1]! - heights[0]!).toBe(32);
    expect(heights.at(-1)).toBeLessThanOrEqual(720 - 18 - 40);
    expect(holesOf(m, 'side:R', 'shelf-pin').every((h) => h.face === 'B')).toBe(true);
    expect(hw(m, doc, 'shelf-pin')).toMatchObject({ quantity: 9, spareIncluded: 1 });
  });

  it('CON-009: bookcase column 2 rows on the divider face A start at y 74', () => {
    const doc = template('bookcase');
    const m = model(doc);
    const divider = `divider:${doc.layout.columns[0]!.id}`;
    const pins = holesOf(m, divider, 'shelf-pin');
    expect(pins.every((h) => h.face === 'A')).toBe(true);
    // Divider local u starts at hP + t = 18.
    expect(Math.min(...pins.map((h) => h.uMm)) + 18).toBe(74);
    // Deviation (progress record): the right side of column 2 uses the same shifted rows.
    expect(Math.min(...holesOf(m, 'side:R', 'shelf-pin').map((h) => h.uMm))).toBe(74);
  });

  it('AC-009: pin holes conflicting with through screw holes on the other face are suppressed', () => {
    const doc = carcassDesign(800, 720, 400);
    // Column 2's fixed shelf centre at 18 + 95 + 9 = 122 meets column 1's pin row at 122 on the divider.
    setColumns(doc, [
      [section({ mode: 'auto' }, { interior: { kind: 'adjustableShelves', count: 1 } })],
      [section({ mode: 'fixed', valueMm: 95 }), section()],
    ]);
    const m = model(doc);
    const divider = 'divider:col-1';
    const dividerPins = holesOf(m, divider, 'shelf-pin').filter((h) => h.face === 'B');
    expect(dividerPins.some((h) => h.uMm === 122 - 18)).toBe(false);
    expect(dividerPins.some((h) => h.uMm === 90 - 18)).toBe(true);
    expect(holesOf(m, 'side:L', 'shelf-pin').some((h) => h.uMm === 122)).toBe(true);
  });
});

describe('plinth (T-014)', () => {
  it('CON-015: rails, frame screws, brackets and bracket screws', () => {
    const doc = plinthCabinet();
    const m = model(doc);
    expect(size(part(m, 'plinth:L'))).toEqual([400, 100, 18]);
    expect(size(part(m, 'plinth:R'))).toEqual([400, 100, 18]);
    expect(size(part(m, 'plinth:F'))).toEqual([764, 100, 18]);
    expect(size(part(m, 'plinth:B'))).toEqual([764, 100, 18]);
    expect(holesOf(m, 'plinth:L', 'plinth-screw')).toHaveLength(4);
    expect(hw(m, doc, 'screw:plinthScrew')).toMatchObject({ quantity: 9, spareIncluded: 1 });
    expect(hw(m, doc, 'plinth-bracket')).toMatchObject({ quantity: 8, spareIncluded: 0 });
    expect(hw(m, doc, 'screw:plinthBracket')).toMatchObject({ quantity: 36, spareIncluded: 4 });
  });

  it('SCREW_TOO_LONG for bracket screws longer than t − remaining + 2', () => {
    const doc = plinthCabinet();
    doc.hardware.plinthBracket.screwLengthMm = 17;
    expect(codes(model(doc))).not.toContain('SCREW_TOO_LONG');
    doc.hardware.plinthBracket.screwLengthMm = 18;
    expect(model(doc).issues).toContainEqual(
      expect.objectContaining({ code: 'SCREW_TOO_LONG', target: { kind: 'profile', id: 'plinthBracket', field: 'screwLengthMm' } }),
    );
  });
});

describe('clothes rail (T-014)', () => {
  it('AC-010: tube = clear width − 4, two supports, warnings for depth, span and height', () => {
    const doc = carcassDesign(1100, 720, 400);
    setColumns(doc, [[section({ mode: 'auto' }, { interior: { kind: 'clothesRail' } })]]);
    const m = model(doc);
    expect(hw(m, doc, 'rail:1060')).toMatchObject({ quantity: 1, profileKey: 'clothesRail', verified: false });
    expect(hw(m, doc, 'rail-support')?.quantity).toBe(2);
    expect(hw(m, doc, 'screw:clothesRail')?.quantity).toBe(5);
    const supports = m.marks.filter((mk) => mk.purpose === 'rail-support');
    expect(supports.map((mk) => [mk.partId, mk.face, mk.uMm])).toEqual([
      ['side:L', 'A', 720 - 18 - 60],
      ['side:R', 'B', 720 - 18 - 60],
    ]);
    expect(codes(m)).toEqual(['HARDWARE_PROFILE_UNVERIFIED', 'RAIL_SECTION_LOW', 'RAIL_SHALLOW_DEPTH', 'RAIL_SPAN_LONG']);

    const deep = carcassDesign(1000, 2000, 600);
    setColumns(deep, [[section({ mode: 'auto' }, { interior: { kind: 'clothesRail' } })]]);
    deep.hardware.clothesRail.verifiedByUser = true;
    expect(codes(model(deep))).toEqual(['TALL_FURNITURE_ANCHOR']);
  });

  it('NARROW_COMPARTMENT_TOOL_ACCESS for a rail in a column below 150 mm', () => {
    const doc = carcassDesign(800, 720, 400);
    setColumns(
      doc,
      [[section({ mode: 'auto' }, { interior: { kind: 'clothesRail' } })], [section()]],
      [{ mode: 'fixed', valueMm: 140 }, { mode: 'auto' }],
    );
    expect(codes(model(doc))).toContain('NARROW_COMPARTMENT_TOOL_ACCESS');
  });
});

describe('tool access (T-014)', () => {
  it('CON-018: offset exactly 50 is allowed; a 120 mm section around the P2 screw warns', () => {
    const doc = carcassDesign(800, 1000, 300);
    setColumns(doc, [
      [section({ mode: 'fixed', valueMm: 473 }), section({ mode: 'fixed', valueMm: 120 }), section()],
      [section({ mode: 'fixed', valueMm: 523 }), section()],
    ]);
    const m = model(doc);
    expect(m.marks.some((mk) => mk.purpose === 'shelf-bracket')).toBe(false);
    const tight = m.issues.filter((i) => i.code === 'TOOL_ACCESS_TIGHT');
    expect(tight).toHaveLength(1);
    expect(tight[0]?.target.id).toBe(doc.layout.columns[0]!.sections[1]!.id);
    expect(tight[0]?.params).toEqual({ screwYMm: 550, clearanceMm: 41, heightMm: 120 });

    doc.layout.columns[0]!.sections[1]!.height = { mode: 'fixed', valueMm: 200 };
    expect(codes(model(doc))).not.toContain('TOOL_ACCESS_TIGHT');
  });

  it('CON-014 layout: no TOOL_ACCESS_TIGHT', () => {
    const doc = carcassDesign(1200, 2000, 300);
    setColumns(doc, [
      [section(), section(), section(), section()],
      [section(), section(), section()],
      [section(), section(), section(), section()],
    ]);
    const m = model(doc);
    const centres = (ci: number) => m.layout.columns[ci]!.sections.slice(0, -1).map((s) => s.y1 + 9);
    expect(centres(0)).toEqual([505, 1001, 1496]);
    expect(centres(1)).toEqual([670, 1331]);
    expect(codes(m)).not.toContain('TOOL_ACCESS_TIGHT');
  });
});

describe('every hole and mark lies inside its part face (T-014)', () => {
  it.each(['blank', 'bookcase'] as const)('%s', (id) => {
    const doc = template(id);
    doc.carcass.back.fastener = 'screw';
    const m = model(doc);
    for (const item of [...m.holes, ...m.marks]) {
      const p = part(m, item.partId);
      expect(item.uMm, item.id).toBeGreaterThanOrEqual(0);
      expect(item.uMm, item.id).toBeLessThanOrEqual(p.lengthMm);
      expect(item.vMm, item.id).toBeGreaterThanOrEqual(0);
      expect(item.vMm, item.id).toBeLessThanOrEqual(p.widthMm);
    }
  });
});

describe('profile edits change dependent outputs (T-014)', () => {
  const base = () => carcassDesign(800, 2000, 400, { back: 'mat-ply-6' });

  it('construction.screwEdgeDistanceMm and screwMaxSpacingMm', () => {
    const doc = base();
    doc.construction.screwMaxSpacingMm = 100;
    expect(holesOf(model(doc), 'side:L', 'carcass-screw')).toHaveLength(2 * 5);
    doc.construction.screwEdgeDistanceMm = 60;
    expect(holesOf(model(doc), 'side:L', 'carcass-screw')[0]?.vMm).toBe(60);
  });

  it('hardware.carcassScrew clearance and countersink', () => {
    const doc = base();
    doc.hardware.carcassScrew.clearanceHoleMm = 5;
    doc.hardware.carcassScrew.countersinkDiameterMm = 10;
    expect(holesOf(model(doc), 'top')).toHaveLength(0);
    expect(holesOf(model(doc), 'side:L')[0]).toMatchObject({ diameterMm: 5, countersinkDiameterMm: 10 });
  });

  it('hardware.backFastenerSpacingMm and backFastenerEndOffsetMm', () => {
    const doc = base();
    doc.hardware.backFastenerSpacingMm = 200;
    expect(model(doc).marks).toHaveLength(2 * 11 + 2 * 5);
    doc.hardware.backFastenerEndOffsetMm = 50;
    expect(Math.min(...model(doc).marks.map((mk) => mk.uMm))).toBe(9);
  });

  it('hardware.shelfPin row setback, pitch, margin and hole size', () => {
    const doc = carcassDesign(600, 720, 400);
    setColumns(doc, [[section({ mode: 'auto' }, { interior: { kind: 'adjustableShelves', count: 1 } })]]);
    Object.assign(doc.hardware.shelfPin, { rowSetbackMm: 50, pitchMm: 64, marginMm: 60, holeDiameterMm: 6, pinsPerShelf: 6 });
    const m = model(doc);
    const pins = holesOf(m, 'side:L', 'shelf-pin');
    expect([...new Set(pins.map((h) => h.vMm))]).toEqual([50, 347]);
    const heights = [...new Set(pins.map((h) => h.uMm))];
    expect(heights.slice(0, 2)).toEqual([78, 142]);
    expect(pins[0]?.diameterMm).toBe(6);
    expect(hw(m, doc, 'shelf-pin')?.quantity).toBe(7);
  });

  it('hardware.clothesRail end allowance, centre and screws per support', () => {
    const doc = carcassDesign(1000, 2000, 600);
    setColumns(doc, [[section({ mode: 'auto' }, { interior: { kind: 'clothesRail' } })]]);
    Object.assign(doc.hardware.clothesRail, { endAllowanceMm: 5, centerBelowTopMm: 80, screwsPerSupport: 3 });
    const m = model(doc);
    expect(hw(m, doc, 'rail:954')).toBeDefined();
    expect(m.marks.find((mk) => mk.purpose === 'rail-support')?.uMm).toBe(2000 - 18 - 80);
    expect(hw(m, doc, 'screw:clothesRail')?.quantity).toBe(7);
  });

  it('hardware.plinthBracket spacing and screws per bracket', () => {
    const doc = plinthCabinet();
    doc.hardware.plinthBracket.maxSpacingMm = 200;
    doc.hardware.plinthBracket.screwsPerBracket = 2;
    const m = model(doc);
    expect(hw(m, doc, 'plinth-bracket')?.quantity).toBe(2 * 2 + 2 * 4);
    expect(hw(m, doc, 'screw:plinthBracket')?.quantity).toBe(Math.ceil(24 * 1.1));
  });

  it('construction.toolClearanceMm and toolBodyClearanceMm', () => {
    const doc = carcassDesign(800, 1000, 300);
    setColumns(doc, [
      [section({ mode: 'fixed', valueMm: 473 }), section({ mode: 'fixed', valueMm: 200 }), section()],
      [section({ mode: 'fixed', valueMm: 523 }), section()],
    ]);
    expect(codes(model(doc))).not.toContain('TOOL_ACCESS_TIGHT');
    doc.construction.toolClearanceMm = 45;
    expect(codes(model(doc))).toContain('TOOL_ACCESS_TIGHT');
    doc.construction.toolClearanceMm = 35;
    doc.construction.toolBodyClearanceMm = 250;
    expect(codes(model(doc))).toContain('TOOL_ACCESS_TIGHT');
  });
});
