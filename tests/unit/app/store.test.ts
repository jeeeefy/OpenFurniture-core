import { describe, expect, it } from 'vitest';
import { createDesign, setCarcassDimension, setMaterialAssignment, splitSection, removeColumn } from '@/domain';
import { createEditorStore } from '@/app/store/editorStore';
import { ownerSelection, partsOfSelection, selectDerived, selectOutputs } from '@/app/store/selectors';
import { counterIds, NOW } from '../helpers';

function loaded(template: 'bookcase' | 'blank' = 'bookcase') {
  const store = createEditorStore();
  const doc = createDesign(template, counterIds(), NOW, 'Test');
  store.getState().load(doc, 1);
  return { store, doc };
}

function model(doc: Parameters<typeof selectDerived>[0]) {
  const derived = selectDerived(doc);
  if (!derived.ok) throw new Error('derive failed');
  return derived.model;
}

describe('editor store (T-008)', () => {
  it('commit applies an operation and marks the design dirty', () => {
    const { store, doc } = loaded();
    const result = store.getState().commit(setCarcassDimension, { field: 'widthMm', value: 900 });
    expect(result.ok).toBe(true);
    const state = store.getState();
    expect(state.doc?.carcass.widthMm).toBe(900);
    expect(state.doc).not.toBe(doc);
    expect(state.saveStatus).toBe('dirty');
    expect(state.lastRejection).toBeNull();
  });

  it('a rejected operation keeps doc and exposes the reason', () => {
    const { store, doc } = loaded();
    const result = store.getState().commit(setCarcassDimension, { field: 'widthMm', value: 150 });
    expect(result).toEqual({ ok: false, reason: 'out-of-range' });
    expect(store.getState().doc).toBe(doc);
    expect(store.getState().lastRejection).toBe('out-of-range');
    expect(store.getState().saveStatus).toBe('saved');
  });

  it('clears a selection whose target was removed', () => {
    const { store, doc } = loaded();
    const column = doc.layout.columns[0]!;
    store.getState().select({ kind: 'column', id: column.id });
    store.getState().commit(removeColumn, { columnId: column.id });
    expect(store.getState().selection).toBeNull();
  });

  it('markSaved keeps "dirty" when the document changed during the save', () => {
    const { store } = loaded();
    store.getState().commit(setCarcassDimension, { field: 'widthMm', value: 900 });
    const saving = store.getState().doc!;
    store.getState().commit(setCarcassDimension, { field: 'widthMm', value: 950 });
    store.getState().markSaved(2, saving);
    expect(store.getState()).toMatchObject({ baseRevision: 2, saveStatus: 'dirty' });
    store.getState().markSaved(3, store.getState().doc!);
    expect(store.getState()).toMatchObject({ baseRevision: 3, saveStatus: 'saved' });
  });
});

describe('selectors (T-008)', () => {
  it('memoises derivation and outputs by document identity', () => {
    const { doc } = loaded();
    expect(selectDerived(doc)).toBe(selectDerived(doc));
    expect(selectOutputs(doc)).toBe(selectOutputs(doc));
    expect(selectOutputs(doc)?.positions.length).toBe(8);
  });

  it('returns no outputs while errors exist', () => {
    const { doc } = loaded('blank');
    const result = setMaterialAssignment(doc, { group: 'back', materialId: 'mat-ply-9' });
    if (!result.ok) throw new Error(result.reason);
    expect(selectOutputs(result.doc)).toBeNull();
  });

  it('maps parts to owner nodes (plan §6.2)', () => {
    const { doc } = loaded();
    const m = model(doc);
    const byId = (id: string) => m.parts.find((p) => p.id === id)!;
    const [col1, col2] = doc.layout.columns;
    expect(ownerSelection(doc, byId('side:L'))).toEqual({ kind: 'carcass', id: 'carcass' });
    expect(ownerSelection(doc, byId('back'))).toEqual({ kind: 'carcass', id: 'carcass' });
    expect(ownerSelection(doc, byId(`divider:${col1!.id}`))).toEqual({ kind: 'column', id: col1!.id });
    expect(ownerSelection(doc, byId(`fixed:${col1!.sections[0]!.id}`))).toEqual({ kind: 'section', id: col1!.sections[0]!.id });
    expect(ownerSelection(doc, byId(`adj:${col2!.sections[0]!.id}:1`))).toEqual({ kind: 'section', id: col2!.sections[0]!.id });
  });

  it('selecting a section maps to its parts and back', () => {
    const { doc } = loaded();
    const m = model(doc);
    const section = doc.layout.columns[1]!.sections[0]!;
    const parts = partsOfSelection(doc, m, { kind: 'section', id: section.id });
    expect(parts).toEqual([1, 2, 3, 4].map((j) => `adj:${section.id}:${j}`));
    for (const id of parts) {
      expect(ownerSelection(doc, m.parts.find((p) => p.id === id)!)).toEqual({ kind: 'section', id: section.id });
    }
  });

  it('a column selection includes its divider and its sections', () => {
    const { doc } = loaded();
    const split = splitSection(doc, { sectionId: doc.layout.columns[1]!.sections[0]!.id, newSectionId: 'upper' });
    if (!split.ok) throw new Error(split.reason);
    const m = model(split.doc);
    const col1 = split.doc.layout.columns[0]!;
    const parts = partsOfSelection(split.doc, m, { kind: 'column', id: col1.id });
    expect(parts).toContain(`divider:${col1.id}`);
    expect(parts.filter((p) => p.startsWith('fixed:'))).toHaveLength(4);
    expect(parts).not.toContain('side:L');
    expect(partsOfSelection(split.doc, m, { kind: 'carcass', id: 'carcass' })).toEqual(['side:L', 'side:R', 'top', 'bottom', 'back']);
  });
});
