import { describe, expect, it } from 'vitest';
import { mergeSectionWithAbove, setFrontSpan, splitSection, type DesignDocument } from '@/domain';
import { avoidShelves } from '@/domain/rules/hinges';
import { carcassDesign, codes, model, part, section, setColumns } from './fixtures';

const door = (spanSections?: number) => ({
  kind: 'door' as const,
  hinge: 'left' as const,
  handleId: 'h-bar-128',
  ...(spanSections ? { spanSections } : {}),
});

/** 600 × 1600 × 560, one column: a door on the lower section spanning both sections. */
function spanningDesign(span = 2): DesignDocument {
  const doc = carcassDesign(600, 1600, 560);
  setColumns(doc, [
    [
      section({ mode: 'fixed', valueMm: 700 }, { id: 'sec-low', front: door(span) }),
      section({ mode: 'auto' }, { id: 'sec-high', interior: { kind: 'adjustableShelves', count: 2 } }),
    ],
  ]);
  return doc;
}

describe('doors spanning several sections (across fixed shelves)', () => {
  it('one leaf covers the whole column height; the fixed shelf sits behind it', () => {
    const doc = spanningDesign();
    const m = model(doc);
    expect(m.issues.filter((i) => i.severity === 'error')).toEqual([]);
    const doors = m.parts.filter((p) => p.role === 'door');
    expect(doors).toHaveLength(1);
    const reveal = doc.construction.frontRevealMm;
    expect(doors[0]!.box.min[1]).toBe(reveal);
    expect(doors[0]!.box.max[1]).toBe(1600 - reveal);
    expect(part(m, 'fixed:sec-low').box.max[2]).toBeLessThanOrEqual(doc.carcass.depthMm);
  });

  it('shelves in a covered section use the door setback', () => {
    const doc = spanningDesign();
    const m = model(doc);
    const shelf = m.parts.find((p) => p.role === 'adjustable-shelf')!;
    expect(shelf.box.max[2]).toBe(doc.carcass.depthMm - doc.hardware.shelfPin.shelfFrontSetbackDoorMm);
  });

  it('no hinge mounting plate lands on the covered fixed shelf', () => {
    const doc = spanningDesign();
    const m = model(doc);
    const shelf = part(m, 'fixed:sec-low');
    const side = part(m, 'side:L');
    const yOf = (h: { uMm: number; vMm: number }) => side.box.min[1] + (side.frame.u === 'y' ? h.uMm : h.vMm);
    const plates = m.holes.filter((h) => h.purpose === 'hinge-plate' && h.partId === side.id).map(yOf);
    expect(plates.length).toBeGreaterThan(0);
    for (const y of plates) expect(y < shelf.box.min[1] - 10 || y > shelf.box.max[1] + 10).toBe(true);
  });

  it('avoidShelves moves a hinge to the nearer side of the shelf', () => {
    expect(avoidShelves([705], [{ y0: 700, y1: 718 }], [-16, 16])).toEqual([700 - 36]);
    expect(avoidShelves([716], [{ y0: 700, y1: 718 }], [-16, 16])).toEqual([718 + 36]);
    expect(avoidShelves([300], [{ y0: 700, y1: 718 }], [-16, 16])).toEqual([300]);
  });

  it('splitting a section behind a door makes the door grow; merging shrinks it again', () => {
    const doc = carcassDesign(600, 1600, 560);
    setColumns(doc, [[section({ mode: 'auto' }, { id: 'sec-1', front: door() })]]);
    const split = splitSection(doc, { sectionId: 'sec-1', newSectionId: 'sec-2' });
    if (!split.ok) throw new Error(split.reason);
    const front = split.doc.layout.columns[0]!.sections[0]!.front;
    expect(front).toMatchObject({ kind: 'door', spanSections: 2 });
    const m = model(split.doc);
    expect(m.parts.filter((p) => p.role === 'door')).toHaveLength(1);
    expect(m.parts.find((p) => p.role === 'door')!.box.max[1]).toBe(1600 - split.doc.construction.frontRevealMm);

    const merged = mergeSectionWithAbove(split.doc, { sectionId: 'sec-1' });
    if (!merged.ok) throw new Error(merged.reason);
    expect(merged.doc.layout.columns[0]!.sections[0]!.front).toEqual(door());
  });

  it('setFrontSpan validates the range and refuses to cover another front', () => {
    const doc = carcassDesign(600, 1600, 560);
    setColumns(doc, [
      [
        section({ mode: 'auto' }, { id: 's1', front: door() }),
        section({ mode: 'auto' }, { id: 's2' }),
        section({ mode: 'auto' }, { id: 's3', front: door() }),
      ],
    ]);
    expect(setFrontSpan(doc, { sectionId: 's1', span: 3 })).toEqual({ ok: false, reason: 'front-overlap' });
    expect(setFrontSpan(doc, { sectionId: 's1', span: 4 })).toEqual({ ok: false, reason: 'out-of-range' });
    expect(setFrontSpan(doc, { sectionId: 's2', span: 2 })).toEqual({ ok: false, reason: 'not-found' });
    const ok = setFrontSpan(doc, { sectionId: 's1', span: 2 });
    expect(ok.ok && ok.doc.layout.columns[0]!.sections[0]!.front).toMatchObject({ spanSections: 2 });
    const back = ok.ok ? setFrontSpan(ok.doc, { sectionId: 's1', span: 1 }) : null;
    expect(back?.ok && back.doc.layout.columns[0]!.sections[0]!.front).toEqual(door());
  });

  it('an invalid stored span is reported as FRONT_SPAN_INVALID', () => {
    expect(codes(model(spanningDesign(3)))).toContain('FRONT_SPAN_INVALID');
    const covered = spanningDesign(2);
    covered.layout.columns[0]!.sections[1]!.front = door();
    expect(codes(model(covered))).toContain('FRONT_SPAN_INVALID');
  });
});
