import type { DesignDocument } from '@/domain';
import { decodeRecord, duplicateDocument, renamedDocument, sortSummaries, summarise, toRecord } from './records';
import { ConflictError, NotFoundError, type DesignRepository, type DuplicateArgs, type StoredDesign } from './types';

/** Used when IndexedDB is unavailable (memory-only mode) and in tests. */
export class MemoryRepository implements DesignRepository {
  readonly kind = 'memory' as const;
  private readonly records = new Map<string, StoredDesign>();

  /** Test hook: inserts a raw record, e.g. a damaged one. */
  putRaw(record: StoredDesign): void {
    this.records.set(record.id, structuredClone(record));
  }

  list() {
    return Promise.resolve(sortSummaries([...this.records.values()].map(summarise)));
  }

  get(id: string) {
    const record = this.records.get(id);
    return Promise.resolve(record ? decodeRecord(structuredClone(record)) : null);
  }

  create(doc: DesignDocument) {
    if (this.records.has(doc.id)) return Promise.reject(new Error(`Design ${doc.id} already exists`));
    this.records.set(doc.id, toRecord(doc, 1));
    return Promise.resolve(1);
  }

  save(doc: DesignDocument, baseRevision: number) {
    return new Promise<number>((resolve) => {
      resolve(this.write(doc, baseRevision));
    });
  }

  async rename(id: string, name: string, baseRevision: number) {
    const loaded = await this.get(id);
    if (loaded?.status !== 'ok') throw new NotFoundError(id);
    return this.write(renamedDocument(loaded.document, name), baseRevision);
  }

  async duplicate(id: string, args: DuplicateArgs) {
    const loaded = await this.get(id);
    if (loaded?.status !== 'ok') throw new NotFoundError(id);
    const copy = duplicateDocument(loaded.document, args);
    await this.create(copy);
    return copy;
  }

  remove(id: string) {
    this.records.delete(id);
    return Promise.resolve();
  }

  private write(doc: DesignDocument, baseRevision: number): number {
    const current = this.records.get(doc.id);
    if (!current) throw new NotFoundError(doc.id);
    if (current.revision !== baseRevision) throw new ConflictError(doc.id, baseRevision, current.revision);
    const revision = current.revision + 1;
    this.records.set(doc.id, toRecord(doc, revision));
    return revision;
  }
}
