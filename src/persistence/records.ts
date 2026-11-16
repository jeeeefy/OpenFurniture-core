import { decodeDesign, LIMITS, renameDesign, type DesignDocument } from '@/domain';
import { MIGRATIONS, type Migrations } from './migrations';
import type { DesignSummary, DuplicateArgs, LoadedDesign, StoredDesign } from './types';

export function toRecord(doc: DesignDocument, revision: number): StoredDesign {
  return { id: doc.id, name: doc.name, revision, updatedAt: doc.updatedAt, document: structuredClone(doc) };
}

/** Reads an arbitrary stored value; malformed metadata is replaced so the record can still be listed. */
export function asStoredDesign(raw: unknown, fallbackId: string): StoredDesign {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Record<keyof StoredDesign, unknown>>;
  return {
    id: typeof r.id === 'string' ? r.id : fallbackId,
    name: typeof r.name === 'string' && r.name.length > 0 ? r.name : fallbackId,
    revision: typeof r.revision === 'number' && Number.isInteger(r.revision) ? r.revision : 0,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : '',
    document: 'document' in r ? r.document : raw,
  };
}

/** Migrates and validates a stored document; anything that fails is reported as damaged, never deleted. */
export function decodeRecord(record: StoredDesign, migrations: Migrations = MIGRATIONS): LoadedDesign {
  const decoded = decodeDesign(record.document, migrations);
  if (!decoded.ok) return { status: 'damaged', revision: record.revision, raw: record.document };
  return { status: 'ok', revision: record.revision, document: decoded.doc };
}

export function summarise(record: StoredDesign): DesignSummary {
  return {
    id: record.id,
    name: record.name,
    revision: record.revision,
    updatedAt: record.updatedAt,
    damaged: decodeRecord(record).status === 'damaged',
  };
}

/** Newest first; ties by name, then id, for a stable list. */
export function sortSummaries(summaries: DesignSummary[]): DesignSummary[] {
  return summaries.sort((a, b) => {
    if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
    if (a.name !== b.name) return a.name.localeCompare(b.name);
    return a.id < b.id ? -1 : 1;
  });
}

export function duplicateDocument(doc: DesignDocument, args: DuplicateArgs): DesignDocument {
  return {
    ...structuredClone(doc),
    id: args.newId,
    name: args.name.trim().slice(0, LIMITS.name.max),
    createdAt: args.nowIso,
    updatedAt: args.nowIso,
  };
}

export function renamedDocument(doc: DesignDocument, name: string): DesignDocument {
  const result = renameDesign(doc, { name });
  if (!result.ok) throw new RangeError(`Invalid design name: ${result.reason}`);
  return result.doc;
}
