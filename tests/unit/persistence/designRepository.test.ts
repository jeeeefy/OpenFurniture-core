import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { afterEach, describe, expect, it } from 'vitest';
import { createDesign } from '@/domain';
import { IndexedDbRepository, openDatabase } from '@/persistence/designRepository';
import { ConflictError } from '@/persistence/types';
import { counterIds, NOW } from '../helpers';

let dbCounter = 0;
const opened: IndexedDbRepository[] = [];

async function freshRepo() {
  dbCounter += 1;
  const name = `fd-test-${dbCounter}`;
  const repo = await IndexedDbRepository.open(name);
  opened.push(repo);
  return { repo, name };
}

afterEach(() => {
  for (const repo of opened.splice(0)) repo.close();
});

const design = (name = 'Shelf', prefix = 'a') => createDesign('blank', counterIds(prefix), NOW, name);

describe('IndexedDbRepository (T-009)', () => {
  it('creates, saves with revision check and reloads', async () => {
    const { repo } = await freshRepo();
    const doc = design();
    expect(await repo.create(doc)).toBe(1);
    expect(await repo.save({ ...doc, name: 'Changed' }, 1)).toBe(2);
    await expect(repo.save(doc, 1)).rejects.toBeInstanceOf(ConflictError);
    const loaded = await repo.get(doc.id);
    expect(loaded).toMatchObject({ status: 'ok', revision: 2, document: { name: 'Changed' } });
  });

  it('a failed conflict check leaves the stored record unchanged', async () => {
    const { repo } = await freshRepo();
    const doc = design();
    await repo.create(doc);
    await expect(repo.save({ ...doc, name: 'Lost' }, 7)).rejects.toBeInstanceOf(ConflictError);
    expect(await repo.get(doc.id)).toMatchObject({ revision: 1, document: { name: 'Shelf' } });
  });

  it('lists damaged records without deleting them', async () => {
    const { repo, name } = await freshRepo();
    await repo.create(design());
    const raw = await openDB(name);
    await raw.put('designs', { id: 'broken', name: 'Broken', revision: 4, updatedAt: '2026-01-01', document: { nope: true } });
    await raw.put('designs', { id: 'garbage' });
    raw.close();

    const list = await repo.list();
    expect(list.map((s) => [s.id, s.damaged])).toEqual([
      ['a-1', false],
      ['broken', true],
      ['garbage', true],
    ]);
    expect(await repo.get('broken')).toEqual({ status: 'damaged', revision: 4, raw: { nope: true } });
    expect((await repo.list()).length).toBe(3);
  });

  it('renames, duplicates and removes (AC-039 domain part)', async () => {
    const { repo } = await freshRepo();
    const doc = design();
    await repo.create(doc);
    expect(await repo.rename(doc.id, 'Hall', 1)).toBe(2);
    const copy = await repo.duplicate(doc.id, { newId: 'copy', nowIso: NOW, name: 'Copy of Hall' });
    expect(copy.name).toBe('Copy of Hall');
    await repo.remove(doc.id);
    expect((await repo.list()).map((s) => s.name)).toEqual(['Copy of Hall']);
  });

  it('openDatabase falls back to memory when IndexedDB is unavailable (AC-045 domain part)', async () => {
    const original = globalThis.indexedDB;
    Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true, writable: true });
    try {
      expect((await openDatabase('fd-unavailable')).kind).toBe('memory');
    } finally {
      Object.defineProperty(globalThis, 'indexedDB', { value: original, configurable: true, writable: true });
    }
    const repo = await openDatabase(`fd-test-${++dbCounter}`);
    expect(repo.kind).toBe('indexeddb');
    (repo as IndexedDbRepository).close();
  });
});
