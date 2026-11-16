import { describe, expect, it } from 'vitest';
import { createDesign } from '@/domain';
import { MemoryRepository } from '@/persistence/memoryRepository';
import { ConflictError, NotFoundError } from '@/persistence/types';
import { counterIds, NOW } from '../helpers';

const LATER = '2026-11-08T10:00:00.000Z';

function design(name = 'Shelf', prefix = 'a') {
  return createDesign('blank', counterIds(prefix), NOW, name);
}

describe('MemoryRepository (T-008)', () => {
  it('creates with revision 1 and saves with revision + 1', async () => {
    const repo = new MemoryRepository();
    const doc = design();
    expect(await repo.create(doc)).toBe(1);
    expect(await repo.save({ ...doc, carcass: { ...doc.carcass, widthMm: 700 } }, 1)).toBe(2);
    const loaded = await repo.get(doc.id);
    expect(loaded).toMatchObject({ status: 'ok', revision: 2 });
    expect(loaded?.status === 'ok' && loaded.document.carcass.widthMm).toBe(700);
  });

  it('detects revision conflicts and never overwrites silently (AC-046 domain part)', async () => {
    const repo = new MemoryRepository();
    const doc = design();
    await repo.create(doc);
    await repo.save(doc, 1);
    await expect(repo.save(doc, 1)).rejects.toBeInstanceOf(ConflictError);
    expect((await repo.get(doc.id))?.revision).toBe(2);
    await expect(repo.save(design('Other', 'b'), 1)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('lists newest first and flags damaged records', async () => {
    const repo = new MemoryRepository();
    const older = design('Older', 'a');
    const newer = { ...design('Newer', 'b'), updatedAt: LATER };
    await repo.create(older);
    await repo.create(newer);
    repo.putRaw({ id: 'broken', name: 'Broken', revision: 3, updatedAt: '2026-01-01T00:00:00.000Z', document: { schemaVersion: 1 } });
    expect((await repo.list()).map((s) => [s.name, s.damaged])).toEqual([
      ['Newer', false],
      ['Older', false],
      ['Broken', true],
    ]);
    expect(await repo.get('broken')).toEqual({ status: 'damaged', revision: 3, raw: { schemaVersion: 1 } });
  });

  it('renames with a revision check, duplicates and removes', async () => {
    const repo = new MemoryRepository();
    const doc = design();
    await repo.create(doc);
    expect(await repo.rename(doc.id, '  Hall  ', 1)).toBe(2);
    expect((await repo.list())[0]?.name).toBe('Hall');
    await expect(repo.rename(doc.id, 'X', 1)).rejects.toBeInstanceOf(ConflictError);
    await expect(repo.rename(doc.id, '   ', 2)).rejects.toBeInstanceOf(RangeError);

    const copy = await repo.duplicate(doc.id, { newId: 'copy-1', nowIso: LATER, name: 'Copy of Hall' });
    expect(copy).toMatchObject({ id: 'copy-1', name: 'Copy of Hall', createdAt: LATER, updatedAt: LATER });
    expect((await repo.get('copy-1'))?.revision).toBe(1);

    await repo.remove(doc.id);
    expect(await repo.get(doc.id)).toBeNull();
    expect((await repo.list()).map((s) => s.id)).toEqual(['copy-1']);
  });

  it('stores copies, not references', async () => {
    const repo = new MemoryRepository();
    const doc = design();
    await repo.create(doc);
    doc.carcass.widthMm = 999;
    const loaded = await repo.get(doc.id);
    expect(loaded?.status === 'ok' && loaded.document.carcass.widthMm).toBe(600);
  });
});
