import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { DesignDocument } from '@/domain';
import { MemoryRepository } from './memoryRepository';
import { asStoredDesign, decodeRecord, duplicateDocument, renamedDocument, sortSummaries, summarise, toRecord } from './records';
import { ConflictError, NotFoundError, type DesignRepository, type DuplicateArgs } from './types';

export const DB_NAME = 'furniture-designer';
const DB_VERSION = 1;
const STORE = 'designs';

interface DesignDb extends DBSchema {
  designs: { key: string; value: unknown; indexes: { updatedAt: string } };
}

export class IndexedDbRepository implements DesignRepository {
  readonly kind = 'indexeddb' as const;

  private constructor(private readonly db: IDBPDatabase<DesignDb>) {}

  static async open(name = DB_NAME): Promise<IndexedDbRepository> {
    const db = await openDB<DesignDb>(name, DB_VERSION, {
      upgrade(database) {
        const store = database.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      },
    });
    return new IndexedDbRepository(db);
  }

  close(): void {
    this.db.close();
  }

  async list() {
    const tx = this.db.transaction(STORE, 'readonly');
    const summaries = [];
    for (let cursor = await tx.store.openCursor(); cursor; cursor = await cursor.continue()) {
      summaries.push(summarise(asStoredDesign(cursor.value, cursor.key)));
    }
    await tx.done;
    return sortSummaries(summaries);
  }

  async get(id: string) {
    const raw = await this.db.get(STORE, id);
    return raw === undefined ? null : decodeRecord(asStoredDesign(raw, id));
  }

  async create(doc: DesignDocument) {
    await this.db.add(STORE, toRecord(doc, 1));
    return 1;
  }

  /** Revision check and write in one readwrite transaction (plan §4.11). */
  async save(doc: DesignDocument, baseRevision: number) {
    const tx = this.db.transaction(STORE, 'readwrite');
    const raw = await tx.store.get(doc.id);
    if (raw === undefined) {
      tx.abort();
      await tx.done.catch(() => undefined);
      throw new NotFoundError(doc.id);
    }
    const current = asStoredDesign(raw, doc.id).revision;
    if (current !== baseRevision) {
      tx.abort();
      await tx.done.catch(() => undefined);
      throw new ConflictError(doc.id, baseRevision, current);
    }
    const revision = current + 1;
    await tx.store.put(toRecord(doc, revision));
    await tx.done;
    return revision;
  }

  async rename(id: string, name: string, baseRevision: number) {
    const loaded = await this.get(id);
    if (loaded?.status !== 'ok') throw new NotFoundError(id);
    return this.save(renamedDocument(loaded.document, name), baseRevision);
  }

  async duplicate(id: string, args: DuplicateArgs) {
    const loaded = await this.get(id);
    if (loaded?.status !== 'ok') throw new NotFoundError(id);
    const copy = duplicateDocument(loaded.document, args);
    await this.create(copy);
    return copy;
  }

  async remove(id: string) {
    await this.db.delete(STORE, id);
  }
}

/** Falls back to memory-only mode when IndexedDB cannot be opened (AC-045). */
export async function openDatabase(name = DB_NAME): Promise<DesignRepository> {
  try {
    return await IndexedDbRepository.open(name);
  } catch {
    return new MemoryRepository();
  }
}
