import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createDesign, removeColumn, setCarcassDimension } from '@/domain';
import { AppContext, type AppServices } from '@/app/context';
import { coreRoutes } from '@/app/router';
import { UndoRedo } from '@/app/components/UndoRedo';
import { createEditorStore } from '@/app/store/editorStore';
import { MAX_HISTORY } from '@/app/store/history';
import { I18nProvider } from '@/i18n/useT';
import { MemoryRepository } from '@/persistence/memoryRepository';
import { counterIds, NOW } from '../helpers';

function setup() {
  const editor = createEditorStore();
  const doc = createDesign('bookcase', counterIds(), NOW, 'Shelf');
  editor.getState().load(doc, 1);
  const services: AppServices = {
    repo: new MemoryRepository(),
    editor,
    locale: 'en',
    setLocale: () => undefined,
    newId: counterIds('new'),
    nowIso: () => NOW,
    routes: coreRoutes(),
  };
  render(
    <I18nProvider locale="en">
      <AppContext.Provider value={services}>
        <UndoRedo />
        <input aria-label="text field" />
        <input type="checkbox" aria-label="check" />
      </AppContext.Provider>
    </I18nProvider>,
  );
  return { editor, doc };
}

describe('undo/redo (AC-049, T-011)', () => {
  it('restores removed columns and redoes them via buttons', () => {
    const { editor, doc } = setup();
    const undoButton = screen.getByRole('button', { name: 'Undo' });
    const redoButton = screen.getByRole('button', { name: 'Redo' });
    expect(undoButton).toHaveProperty('disabled', true);

    act(() => {
      editor.getState().commit(removeColumn, { columnId: doc.layout.columns[0]!.id });
    });
    expect(editor.getState().doc?.layout.columns).toHaveLength(1);
    fireEvent.click(undoButton);
    expect(editor.getState().doc).toBe(doc);
    expect(editor.getState().doc?.layout.columns).toHaveLength(2);
    expect(editor.getState().saveStatus).toBe('dirty');
    fireEvent.click(redoButton);
    expect(editor.getState().doc?.layout.columns).toHaveLength(1);
  });

  it('keyboard: Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y and Cmd+Z outside text fields', () => {
    const { editor } = setup();
    editor.getState().commit(setCarcassDimension, { field: 'widthMm', value: 900 });
    editor.getState().commit(setCarcassDimension, { field: 'widthMm', value: 1000 });
    const width = () => editor.getState().doc?.carcass.widthMm;

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(width()).toBe(900);
    fireEvent.keyDown(window, { key: 'Z', metaKey: true });
    expect(width()).toBe(800);
    fireEvent.keyDown(window, { key: 'Z', ctrlKey: true, shiftKey: true });
    expect(width()).toBe(900);
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
    expect(width()).toBe(1000);

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'text field' }), { key: 'z', ctrlKey: true });
    expect(width()).toBe(1000);
    // Checkboxes and radios are not text fields: the shortcut applies there.
    fireEvent.keyDown(screen.getByRole('checkbox', { name: 'check' }), { key: 'z', ctrlKey: true });
    expect(width()).toBe(900);
  });

  it('a new edit clears redo; history is cleared on load and capped at 100', () => {
    const { editor, doc } = setup();
    editor.getState().commit(setCarcassDimension, { field: 'widthMm', value: 900 });
    editor.getState().undo();
    editor.getState().commit(setCarcassDimension, { field: 'widthMm', value: 950 });
    expect(editor.getState().redo()).toBe(false);

    editor.getState().load(doc, 1);
    expect(editor.getState().undo()).toBe(false);

    for (let i = 0; i < MAX_HISTORY + 20; i += 1) {
      editor.getState().commit(setCarcassDimension, { field: 'widthMm', value: 300 + i });
    }
    expect(editor.getState().history.past).toHaveLength(MAX_HISTORY);
    let steps = 0;
    while (editor.getState().undo()) steps += 1;
    expect(steps).toBe(MAX_HISTORY);
    expect(editor.getState().doc?.carcass.widthMm).toBe(319);
  });

  it('rejected operations create no history entry', () => {
    const { editor } = setup();
    editor.getState().commit(setCarcassDimension, { field: 'widthMm', value: 10 });
    expect(editor.getState().history.past).toHaveLength(0);
  });
});
