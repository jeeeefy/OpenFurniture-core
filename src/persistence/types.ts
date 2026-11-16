import type { DesignDocument } from '@/domain';

export interface StoredDesign {
  id: string;
  name: string;
  revision: number;
  updatedAt: string;
  document: unknown;
}

export interface DesignSummary {
  id: string;
  name: string;
  revision: number;
  updatedAt: string;
  /** Failed migration or schema validation; offered for raw export and deletion only. */
  damaged: boolean;
}

export type LoadedDesign =
  | { status: 'ok'; revision: number; document: DesignDocument }
  | { status: 'damaged'; revision: number; raw: unknown };

export class ConflictError extends Error {
  constructor(
    readonly id: string,
    readonly expectedRevision: number,
    readonly actualRevision: number,
  ) {
    super(`Design ${id} was changed elsewhere (expected revision ${expectedRevision}, found ${actualRevision})`);
    this.name = 'ConflictError';
  }
}

export class NotFoundError extends Error {
  constructor(readonly id: string) {
    super(`Design ${id} not found`);
    this.name = 'NotFoundError';
  }
}

/** The store is temporarily unreachable (e.g. cloud API down); saving will retry. */
export class RetryableError extends Error {
  constructor(message = 'Temporarily unavailable') {
    super(message);
    this.name = 'RetryableError';
  }
}

/** The store is read-only (e.g. a shared view link); saving is disabled. */
export class ReadOnlyError extends Error {
  constructor(message = 'Read-only') {
    super(message);
    this.name = 'ReadOnlyError';
  }
}

export interface DuplicateArgs {
  newId: string;
  nowIso: string;
  /** Localised by the caller, e.g. "Copy of …" / "Kopie von …". */
  name: string;
}

/** Plan §4.11. Every write is one transaction; revisions guard against silent overwrites. */
export interface DesignRepository {
  readonly kind: 'indexeddb' | 'memory' | 'cloud';
  list(): Promise<DesignSummary[]>;
  get(id: string): Promise<LoadedDesign | null>;
  /** Stores a new design with revision 1. */
  create(doc: DesignDocument): Promise<number>;
  /** Writes `revision + 1`; throws `ConflictError` if the stored revision differs from `baseRevision`. */
  save(doc: DesignDocument, baseRevision: number): Promise<number>;
  rename(id: string, name: string, baseRevision: number): Promise<number>;
  duplicate(id: string, args: DuplicateArgs): Promise<DesignDocument>;
  remove(id: string): Promise<void>;
}
