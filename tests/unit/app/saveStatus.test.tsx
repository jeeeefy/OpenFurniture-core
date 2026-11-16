import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createDesign, setCarcassDimension } from '@/domain';
import { AppContext, type AppServices } from '@/app/context';
import { coreRoutes } from '@/app/router';
import { SaveStatus } from '@/app/components/SaveStatus';
import { createEditorStore } from '@/app/store/editorStore';
import { I18nProvider } from '@/i18n/useT';
import { createAutosave } from '@/persistence/autosave';
import { MemoryRepository } from '@/persistence/memoryRepository';
import { counterIds, NOW } from '../helpers';

describe('save status (AC-044, T-009)', () => {
  it('a quota error shows "Not saved" with "Export JSON" and keeps the design in memory', async () => {
    const repo = new MemoryRepository();
    const editor = createEditorStore();
    const doc = createDesign('blank', counterIds(), NOW, 'Shelf');
    await repo.create(doc);
    editor.getState().load(doc, 1);
    const onExport = vi.fn();
    const services: AppServices = {
      repo,
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
          <SaveStatus onReload={() => undefined} onSaveAsCopy={() => undefined} onExport={onExport} />
        </AppContext.Provider>
      </I18nProvider>,
    );

    vi.spyOn(repo, 'save').mockRejectedValueOnce(Object.assign(new Error('full'), { name: 'QuotaExceededError' }));
    const autosave = createAutosave(
      repo,
      () => editor.getState(),
      (event) => {
        if (event.status === 'error') editor.getState().setSaveStatus('error');
      },
      { nowIso: () => NOW },
    );
    await act(async () => {
      editor.getState().commit(setCarcassDimension, { field: 'widthMm', value: 650 });
      autosave.notifyChange();
      await autosave.flush();
    });

    expect(screen.getByTestId('save-status').textContent).toBe('Not saved');
    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(editor.getState().doc?.carcass.widthMm).toBe(650);
    expect((await repo.list()).map((d) => d.id)).toEqual([doc.id]);
    autosave.dispose();
  });
});
