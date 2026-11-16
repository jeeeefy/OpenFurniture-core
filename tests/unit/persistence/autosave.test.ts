import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDesign, setCarcassDimension } from '@/domain';
import { createEditorStore } from '@/app/store/editorStore';
import { createAutosave, type AutosaveEvent } from '@/persistence/autosave';
import { MemoryRepository } from '@/persistence/memoryRepository';
import { ReadOnlyError, RetryableError, type DesignRepository } from '@/persistence/types';
import { counterIds, NOW } from '../helpers';

const SAVED_AT = '2026-11-09T12:00:00.000Z';

async function setup(repo: DesignRepository = new MemoryRepository()) {
  const doc = createDesign('blank', counterIds(), NOW, 'Shelf');
  await repo.create(doc);
  const store = createEditorStore();
  store.getState().load(doc, 1);
  const events: AutosaveEvent['status'][] = [];
  const onFirstSave = vi.fn();
  const autosave = createAutosave(
    repo,
    () => store.getState(),
    (event) => {
      events.push(event.status);
      if (event.status === 'saved') store.getState().markSaved(event.revision, event.doc);
      else if (event.status === 'saving') store.getState().setSaveStatus('saving');
      else store.getState().setSaveStatus(event.status);
    },
    { nowIso: () => SAVED_AT, onFirstSave },
  );
  const edit = (width: number) => {
    store.getState().commit(setCarcassDimension, { field: 'widthMm', value: width });
    autosave.notifyChange();
  };
  return { repo, doc, store, autosave, events, edit, onFirstSave };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('autosave (T-009)', () => {
  it('debounces 500 ms, then saves with a new updatedAt and reports "saved"', async () => {
    const { repo, doc, store, autosave, events, edit, onFirstSave } = await setup();
    edit(700);
    edit(710);
    await vi.advanceTimersByTimeAsync(499);
    expect(events).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    await autosave.flush();
    expect(events).toEqual(['saving', 'saved']);
    expect(store.getState()).toMatchObject({ saveStatus: 'saved', baseRevision: 2 });
    const stored = await repo.get(doc.id);
    expect(stored).toMatchObject({ revision: 2, document: { updatedAt: SAVED_AT, carcass: { widthMm: 710 } } });
    expect(onFirstSave).toHaveBeenCalledTimes(1);

    edit(720);
    await vi.advanceTimersByTimeAsync(500);
    await autosave.flush();
    expect(onFirstSave).toHaveBeenCalledTimes(1);
    expect(store.getState().baseRevision).toBe(3);
  });

  it('flush saves pending changes immediately', async () => {
    const { repo, doc, autosave, edit } = await setup();
    edit(650);
    await autosave.flush();
    expect((await repo.get(doc.id))?.revision).toBe(2);
  });

  it('a change during a running save is saved afterwards', async () => {
    const { repo, doc, store, autosave, edit } = await setup();
    edit(650);
    await vi.advanceTimersByTimeAsync(500);
    edit(660);
    await autosave.flush();
    await vi.advanceTimersByTimeAsync(500);
    await autosave.flush();
    expect(await repo.get(doc.id)).toMatchObject({ revision: 3, document: { carcass: { widthMm: 660 } } });
    expect(store.getState().saveStatus).toBe('saved');
  });

  it('quota errors keep the document in memory and report "error" (AC-044 domain part)', async () => {
    const repo = new MemoryRepository();
    const quota = Object.assign(new Error('full'), { name: 'QuotaExceededError' });
    const save = vi.spyOn(repo, 'save').mockRejectedValueOnce(quota);
    const { store, autosave, events, edit } = await setup(repo);
    edit(640);
    await autosave.flush();
    expect(events).toEqual(['saving', 'error']);
    expect(store.getState()).toMatchObject({ saveStatus: 'error', doc: { carcass: { widthMm: 640 } } });
    save.mockRestore();
    edit(650);
    await autosave.flush();
    expect(events).toEqual(['saving', 'error', 'saving', 'saved']);
  });

  it('conflicts pause saving until resume (AC-046 domain part)', async () => {
    const { repo, doc, store, autosave, events, edit } = await setup();
    await repo.save(doc, 1);
    edit(640);
    await autosave.flush();
    expect(events).toEqual(['saving', 'conflict']);
    expect(store.getState().saveStatus).toBe('conflict');
    edit(650);
    await vi.advanceTimersByTimeAsync(1000);
    await autosave.flush();
    expect(events).toEqual(['saving', 'conflict']);
    expect((await repo.get(doc.id))?.revision).toBe(2);
  });

  it('retries transient errors with exponential backoff (1s, then 2s)', async () => {
    const repo = new MemoryRepository();
    const save = vi.spyOn(repo, 'save').mockRejectedValue(new RetryableError());
    const { store, autosave, events, edit } = await setup(repo);
    edit(640);
    await autosave.flush();
    expect(events).toEqual(['saving', 'offline']);
    expect(store.getState().saveStatus).toBe('offline');

    await vi.advanceTimersByTimeAsync(999);
    expect(events).toEqual(['saving', 'offline']);
    await vi.advanceTimersByTimeAsync(1);
    expect(events).toEqual(['saving', 'offline', 'saving', 'offline']);

    save.mockRestore();
    await vi.advanceTimersByTimeAsync(1999);
    expect(events).toEqual(['saving', 'offline', 'saving', 'offline']);
    await vi.advanceTimersByTimeAsync(1);
    expect(events).toEqual(['saving', 'offline', 'saving', 'offline', 'saving', 'saved']);
    expect(store.getState().saveStatus).toBe('saved');
  });

  it('read-only errors pause saving (AC-102/read-only)', async () => {
    const repo = new MemoryRepository();
    const save = vi.spyOn(repo, 'save').mockRejectedValue(new ReadOnlyError());
    const { store, autosave, events, edit } = await setup(repo);
    edit(640);
    await autosave.flush();
    expect(events).toEqual(['saving', 'readOnly']);
    expect(store.getState().saveStatus).toBe('readOnly');
    edit(650);
    await vi.advanceTimersByTimeAsync(1000);
    await autosave.flush();
    expect(events).toEqual(['saving', 'readOnly']);
    save.mockRestore();
  });
});
