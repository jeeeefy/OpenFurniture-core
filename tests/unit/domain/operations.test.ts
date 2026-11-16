import { describe, expect, it } from 'vitest';
import {
  addColumn,
  addMaterial,
  mergeSectionWithAbove,
  presetMaterials,
  removeColumn,
  removeMaterial,
  renameDesign,
  resetBandingOverrides,
  setBackFastener,
  setBandingEdges,
  setBase,
  setCarcassDimension,
  setColumnWidth,
  setDrawerFrontHeight,
  setFront,
  setHandle,
  setInterior,
  setMaterialAssignment,
  setSectionHeight,
  splitSection,
  updateConstruction,
  updateHardwareProfile,
  updateMaterial,
  type DesignDocument,
  type OpResult,
} from '@/domain';
import { deepFreeze } from '../helpers';
import { template } from './fixtures';

const frozen = (id: 'bookcase' | 'blank' = 'bookcase') => deepFreeze(template(id));

function ok(result: OpResult): DesignDocument {
  if (!result.ok) throw new Error(`Rejected: ${result.reason}`);
  return result.doc;
}

const sec = (doc: DesignDocument, c: number, s: number) => doc.layout.columns[c]!.sections[s]!;
const drawers = (ids: string[]) => ({
  kind: 'drawers' as const,
  handleId: 'h-bar-128',
  drawers: ids.map((id) => ({ id, frontHeight: { mode: 'auto' as const } })),
});

describe('carcass operations (T-005)', () => {
  it('setCarcassDimension accepts limits and rejects values outside', () => {
    const doc = frozen();
    expect(ok(setCarcassDimension(doc, { field: 'widthMm', value: 2400 })).carcass.widthMm).toBe(2400);
    expect(setCarcassDimension(doc, { field: 'widthMm', value: 150 })).toEqual({ ok: false, reason: 'out-of-range' });
    expect(setCarcassDimension(doc, { field: 'depthMm', value: Number.NaN })).toEqual({ ok: false, reason: 'out-of-range' });
    expect(doc.carcass.widthMm).toBe(800);
  });

  it('setBase validates through the schema', () => {
    const doc = frozen();
    const base = { kind: 'plinth' as const, heightMm: 100, setbackFrontMm: 50, setbackBackMm: 0, setbackSidesMm: 0 };
    expect(ok(setBase(doc, { base })).carcass.base).toEqual(base);
    expect(setBase(doc, { base: { ...base, heightMm: -1 } })).toEqual({ ok: false, reason: 'out-of-range' });
  });

  it('setBackFastener', () => {
    expect(ok(setBackFastener(frozen(), { fastener: 'screw' })).carcass.back.fastener).toBe('screw');
  });

  it('setMaterialAssignment rejects unknown materials', () => {
    const doc = frozen();
    expect(ok(setMaterialAssignment(doc, { group: 'carcass', materialId: 'mat-mel-19' })).carcass.materialIds.carcass).toBe(
      'mat-mel-19',
    );
    expect(setMaterialAssignment(doc, { group: 'carcass', materialId: 'nope' })).toEqual({ ok: false, reason: 'unknown-material' });
  });

  it('renameDesign trims and rejects blank or too long names', () => {
    const doc = frozen();
    expect(ok(renameDesign(doc, { name: '  Hall shelf  ' })).name).toBe('Hall shelf');
    expect(renameDesign(doc, { name: '   ' })).toEqual({ ok: false, reason: 'invalid-name' });
    expect(renameDesign(doc, { name: 'x'.repeat(81) })).toEqual({ ok: false, reason: 'invalid-name' });
  });
});

describe('layout operations (T-005)', () => {
  it('addColumn inserts an auto column with one empty section; max 6', () => {
    let doc = frozen();
    doc = ok(addColumn(doc, { atIndex: 1, columnId: 'new-col', sectionId: 'new-sec' }));
    expect(doc.layout.columns.map((c) => c.id)[1]).toBe('new-col');
    expect(doc.layout.columns[1]).toEqual({
      id: 'new-col',
      width: { mode: 'auto' },
      sections: [{ id: 'new-sec', height: { mode: 'auto' }, interior: { kind: 'empty' }, front: { kind: 'none' } }],
    });
    for (let i = 0; i < 3; i += 1) doc = ok(addColumn(doc, { atIndex: 0, columnId: `c${i}`, sectionId: `s${i}` }));
    expect(addColumn(doc, { atIndex: 0, columnId: 'x', sectionId: 'y' })).toEqual({ ok: false, reason: 'max-columns' });
    expect(addColumn(frozen(), { atIndex: 5, columnId: 'x', sectionId: 'y' })).toEqual({ ok: false, reason: 'out-of-range' });
  });

  it('addColumn rejects duplicate ids', () => {
    const doc = frozen();
    expect(addColumn(doc, { atIndex: 0, columnId: doc.layout.columns[0]!.id, sectionId: 'y' })).toEqual({
      ok: false,
      reason: 'out-of-range',
    });
  });

  it('removeColumn rejects the last column', () => {
    const doc = frozen();
    const one = ok(removeColumn(doc, { columnId: doc.layout.columns[0]!.id }));
    expect(one.layout.columns).toHaveLength(1);
    expect(removeColumn(one, { columnId: one.layout.columns[0]!.id })).toEqual({ ok: false, reason: 'last-column' });
    expect(removeColumn(doc, { columnId: 'missing' })).toEqual({ ok: false, reason: 'not-found' });
  });

  it('setColumnWidth and setSectionHeight', () => {
    const doc = frozen();
    const col = doc.layout.columns[0]!;
    expect(ok(setColumnWidth(doc, { columnId: col.id, width: { mode: 'fixed', valueMm: 300 } })).layout.columns[0]!.width).toEqual({
      mode: 'fixed',
      valueMm: 300,
    });
    expect(setColumnWidth(doc, { columnId: col.id, width: { mode: 'fixed', valueMm: -5 } })).toEqual({
      ok: false,
      reason: 'out-of-range',
    });
    const s = sec(doc, 0, 0);
    expect(sec(ok(setSectionHeight(doc, { sectionId: s.id, height: { mode: 'fixed', valueMm: 400 } })), 0, 0).height).toEqual({
      mode: 'fixed',
      valueMm: 400,
    });
  });

  it('splitSection adds an empty auto section above; max 8', () => {
    let doc = frozen();
    const target = sec(doc, 1, 0);
    doc = ok(splitSection(doc, { sectionId: target.id, newSectionId: 'upper' }));
    const sections = doc.layout.columns[1]!.sections;
    expect(sections.map((s) => s.id)).toEqual([target.id, 'upper']);
    expect(sections[0]!.interior).toEqual(target.interior);
    for (let i = 0; i < 3; i += 1) doc = ok(splitSection(doc, { sectionId: sec(doc, 0, 0).id, newSectionId: `n${i}` }));
    expect(doc.layout.columns[0]!.sections).toHaveLength(8);
    expect(splitSection(doc, { sectionId: sec(doc, 0, 0).id, newSectionId: 'z' })).toEqual({ ok: false, reason: 'max-sections' });
  });

  it('mergeSectionWithAbove keeps the lower contents and merges fixed heights', () => {
    const doc = frozen();
    const lower = sec(doc, 0, 0);
    const merged = ok(mergeSectionWithAbove(doc, { sectionId: lower.id }));
    expect(merged.layout.columns[0]!.sections).toHaveLength(4);
    expect(sec(merged, 0, 0).id).toBe(lower.id);
    expect(sec(merged, 0, 0).height).toEqual({ mode: 'auto' });

    const fixedDoc = ok(setSectionHeight(doc, { sectionId: lower.id, height: { mode: 'fixed', valueMm: 300 } }));
    const fixedBoth = ok(setSectionHeight(fixedDoc, { sectionId: sec(doc, 0, 1).id, height: { mode: 'fixed', valueMm: 400 } }));
    expect(sec(ok(mergeSectionWithAbove(fixedBoth, { sectionId: lower.id })), 0, 0).height).toEqual({ mode: 'fixed', valueMm: 718 });

    expect(mergeSectionWithAbove(doc, { sectionId: sec(doc, 0, 4).id })).toEqual({ ok: false, reason: 'no-section-above' });
  });

  it('setInterior rejects shelves in a drawer section', () => {
    const doc = frozen();
    const s = sec(doc, 0, 0);
    expect(sec(ok(setInterior(doc, { sectionId: s.id, interior: { kind: 'clothesRail' } })), 0, 0).interior).toEqual({
      kind: 'clothesRail',
    });
    const withDrawers = ok(setFront(doc, { sectionId: s.id, front: drawers(['d1']), clearInterior: false }));
    expect(setInterior(withDrawers, { sectionId: s.id, interior: { kind: 'adjustableShelves', count: 2 } })).toEqual({
      ok: false,
      reason: 'drawers-present',
    });
    expect(setInterior(doc, { sectionId: s.id, interior: { kind: 'adjustableShelves', count: 11 } })).toEqual({
      ok: false,
      reason: 'out-of-range',
    });
    expect(
      sec(ok(setInterior(doc, { sectionId: s.id, interior: { kind: 'adjustableShelves', count: 2, positionsMm: [200, 600] } })), 0, 0)
        .interior,
    ).toEqual({ kind: 'adjustableShelves', count: 2, positionsMm: [200, 600] });
  });
});

describe('front operations (T-005)', () => {
  it('setFront to drawers needs an empty interior unless cleared (AC-017)', () => {
    const doc = frozen();
    const shelves = sec(doc, 1, 0);
    expect(setFront(doc, { sectionId: shelves.id, front: drawers(['d1']), clearInterior: false })).toEqual({
      ok: false,
      reason: 'interior-not-empty',
    });
    const cleared = ok(setFront(doc, { sectionId: shelves.id, front: drawers(['d1', 'd2']), clearInterior: true }));
    expect(sec(cleared, 1, 0).interior).toEqual({ kind: 'empty' });
    expect(sec(cleared, 1, 0).front.kind).toBe('drawers');
  });

  it('setFront rejects too many drawers and unknown handles', () => {
    const doc = frozen();
    const s = sec(doc, 0, 0);
    expect(setFront(doc, { sectionId: s.id, front: drawers(['a', 'b', 'c', 'd', 'e', 'f', 'g']), clearInterior: false })).toEqual({
      ok: false,
      reason: 'max-drawers',
    });
    expect(
      setFront(doc, { sectionId: s.id, front: { kind: 'door', hinge: 'left', handleId: 'h-missing' }, clearInterior: false }),
    ).toEqual({ ok: false, reason: 'unknown-handle' });
    const door = ok(setFront(doc, { sectionId: s.id, front: { kind: 'door', hinge: 'right', handleId: null }, clearInterior: false }));
    expect(sec(door, 0, 0).front).toEqual({ kind: 'door', hinge: 'right', handleId: null });
  });

  it('setDrawerFrontHeight and setHandle', () => {
    const doc = frozen();
    const s = sec(doc, 0, 0);
    const withDrawers = ok(setFront(doc, { sectionId: s.id, front: drawers(['d1', 'd2']), clearInterior: false }));
    const changed = ok(setDrawerFrontHeight(withDrawers, { drawerId: 'd2', frontHeight: { mode: 'fixed', valueMm: 150 } }));
    const front = sec(changed, 0, 0).front;
    expect(front.kind === 'drawers' && front.drawers[1]!.frontHeight).toEqual({ mode: 'fixed', valueMm: 150 });
    expect(setDrawerFrontHeight(withDrawers, { drawerId: 'nope', frontHeight: { mode: 'auto' } })).toEqual({
      ok: false,
      reason: 'not-found',
    });

    const knob = ok(setHandle(withDrawers, { sectionId: s.id, handleId: 'h-knob' }));
    expect(sec(knob, 0, 0).front).toMatchObject({ handleId: 'h-knob' });
    expect(setHandle(withDrawers, { sectionId: s.id, handleId: 'missing' })).toEqual({ ok: false, reason: 'unknown-handle' });
    expect(setHandle(doc, { sectionId: s.id, handleId: 'h-knob' })).toEqual({ ok: false, reason: 'not-found' });
  });
});

describe('material and profile operations (T-005)', () => {
  const extra = () => ({ ...presetMaterials()[0]!, id: 'mat-oak', name: 'Oak 20' });

  it('addMaterial up to 20; duplicate ids are rejected', () => {
    let doc = frozen();
    doc = ok(addMaterial(doc, { material: extra() }));
    expect(doc.materials.at(-1)!.id).toBe('mat-oak');
    expect(addMaterial(doc, { material: extra() })).toEqual({ ok: false, reason: 'out-of-range' });
    for (let i = doc.materials.length; i < 20; i += 1) doc = ok(addMaterial(doc, { material: { ...extra(), id: `m${i}` } }));
    expect(addMaterial(doc, { material: { ...extra(), id: 'one-more' } })).toEqual({ ok: false, reason: 'max-materials' });
  });

  it('updateMaterial and removeMaterial', () => {
    const doc = frozen();
    const updated = ok(updateMaterial(doc, { material: { ...doc.materials[0]!, thicknessMm: 19 } }));
    expect(updated.materials[0]!.thicknessMm).toBe(19);
    expect(updateMaterial(doc, { material: { ...doc.materials[0]!, thicknessMm: 1 } })).toEqual({ ok: false, reason: 'out-of-range' });
    expect(updateMaterial(doc, { material: { ...doc.materials[0]!, id: 'nope' } })).toEqual({ ok: false, reason: 'not-found' });
    expect(removeMaterial(doc, { materialId: 'mat-ply-18' })).toEqual({ ok: false, reason: 'material-in-use' });
    expect(ok(removeMaterial(doc, { materialId: 'mat-mdf-19' })).materials.map((m) => m.id)).not.toContain('mat-mdf-19');
  });

  it('setBandingEdges writes sorted unique edges and resetBandingOverrides removes them', () => {
    const doc = frozen('blank');
    expect(setBandingEdges(doc, { partIds: [], edges: ['u0'] })).toEqual({ ok: false, reason: 'not-found' });
    const next = ok(setBandingEdges(doc, { partIds: ['top', 'bottom'], edges: ['v1', 'u0', 'v1'] }));
    expect(next.bandingOverrides).toEqual({ top: ['u0', 'v1'], bottom: ['u0', 'v1'] });
    expect(ok(resetBandingOverrides(next, {})).bandingOverrides).toBeUndefined();
  });

  it('updateHardwareProfile changes only the current design (AC-022 domain part)', () => {
    const doc = frozen();
    const next = ok(updateHardwareProfile(doc, { key: 'hinge', value: { ...doc.hardware.hinge, verifiedByUser: true } }));
    expect(next.hardware.hinge.verifiedByUser).toBe(true);
    expect(doc.hardware.hinge.verifiedByUser).toBe(false);
    expect(
      updateHardwareProfile(doc, { key: 'slide', value: { ...doc.hardware.slide, lengthsMm: [300, 250] } }),
    ).toEqual({ ok: false, reason: 'out-of-range' });
  });

  it('updateConstruction validates ranges and rejects unknown keys', () => {
    const doc = frozen();
    expect(ok(updateConstruction(doc, { patch: { frontGapMm: 4 } })).construction.frontGapMm).toBe(4);
    expect(updateConstruction(doc, { patch: { spareFactor: 2 } })).toEqual({ ok: false, reason: 'out-of-range' });
    expect(updateConstruction(doc, { patch: { bogus: 1 } as never })).toEqual({ ok: false, reason: 'out-of-range' });
  });
});
