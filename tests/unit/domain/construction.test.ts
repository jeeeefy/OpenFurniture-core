import { describe, expect, it } from 'vitest';
import { codes, carcassDesign, model, part, section, setColumns, size } from './fixtures';

describe('construction contract tests (plan §4.10)', () => {
  it('CON-001: 800 × 2000 × 400 carcass with a 6 mm back', () => {
    const m = model(carcassDesign(800, 2000, 400, { back: 'mat-ply-6' }));
    expect(size(part(m, 'side:L'))).toEqual([2000, 394, 18]);
    expect(size(part(m, 'side:R'))).toEqual([2000, 394, 18]);
    expect(size(part(m, 'top'))).toEqual([764, 394, 18]);
    expect(size(part(m, 'bottom'))).toEqual([764, 394, 18]);
    expect(size(part(m, 'back'))).toEqual([2000, 800, 6]);
    expect(m.parts).toHaveLength(5);
  });

  it('CON-002: one divider gives two 373 mm columns', () => {
    const doc = carcassDesign(800, 2000, 400, { back: 'mat-ply-6' });
    setColumns(doc, [[section()], [section()]]);
    const m = model(doc);
    expect(m.layout.columns.map((c) => c.widthMm)).toEqual([373, 373]);
    const divider = part(m, 'divider:col-1');
    expect(size(divider)).toEqual([1964, 394, 18]);
    expect([divider.box.min[0], divider.box.max[0]]).toEqual([391, 409]);
  });

  it('CON-003: adjustable shelf sizes open and behind a door', () => {
    const doc = carcassDesign(800, 2000, 400, { back: 'mat-ply-6' });
    setColumns(doc, [
      [section({ mode: 'auto' }, { interior: { kind: 'adjustableShelves', count: 1 } })],
      [
        section(
          { mode: 'auto' },
          { interior: { kind: 'adjustableShelves', count: 1 }, front: { kind: 'door', hinge: 'left', handleId: null } },
        ),
      ],
    ]);
    const m = model(doc);
    const [open, door] = m.parts.filter((p) => p.role === 'adjustable-shelf');
    expect(open && size(open)).toEqual([371, 390, 18]);
    expect(door && size(door)).toEqual([371, 372, 18]);
  });

  it.each([
    [0, true],
    [30, true],
    [49.9, true],
    [50, false],
    [60, false],
  ])('CON-010 (changed on user request): shelves across a divider at offset %d → angle brackets %s, never an error', (offset, brackets) => {
    const doc = carcassDesign(800, 2000, 400);
    setColumns(doc, [
      [section({ mode: 'fixed', valueMm: 500 }), section()],
      [section({ mode: 'fixed', valueMm: 500 + offset }), section()],
    ]);
    const m = model(doc);
    expect(m.issues.filter((i) => i.severity === 'error')).toEqual([]);
    const divider = `divider:${doc.layout.columns[0]!.id}`;
    const rightShelf = `fixed:${doc.layout.columns[1]!.sections[0]!.id}`;
    const marks = m.marks.filter((mk) => mk.purpose === 'shelf-bracket');
    const screwedThroughDivider = m.joints.some((j) => j.facePartId === divider && j.otherPartId === rightShelf);
    expect(marks.length > 0).toBe(brackets);
    expect(screwedThroughDivider).toBe(!brackets);
    if (brackets) {
      expect(marks.every((mk) => mk.partId === divider && mk.face === 'A')).toBe(true);
      const items = m.hardware.filter((h) => h.key === 'plinth-bracket' && h.partIds.includes(rightShelf));
      expect(items[0]?.quantity).toBe(marks.length);
      // The left shelf is still screwed through the divider.
      const leftShelf = `fixed:${doc.layout.columns[0]!.sections[0]!.id}`;
      expect(m.joints.some((j) => j.facePartId === divider && j.otherPartId === leftShelf)).toBe(true);
    }
  });

  it('CON-011: a 2600 mm side exceeds the plywood sheet but not the melamine sheet', () => {
    const ply = model(carcassDesign(600, 2600, 400));
    expect(ply.issues.filter((i) => i.code === 'PART_EXCEEDS_SHEET').map((i) => i.target.id)).toEqual(['side:L', 'side:R']);
    const mel = model(carcassDesign(600, 2600, 400, { carcass: 'mat-mel-19' }));
    expect(codes(mel)).not.toContain('PART_EXCEEDS_SHEET');
  });
});
