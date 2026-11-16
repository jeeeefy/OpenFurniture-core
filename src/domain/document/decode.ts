import { SCHEMA_VERSION } from './limits';
import { migrate, MIGRATIONS, schemaVersionOf, type Migrations } from './migrations';
import { checkReferences } from './references';
import { designDocumentSchema } from './schema';
import type { DesignDocument } from './types';

const MAX_REPORTED_ISSUES = 5;

/** Stable codes owned by the domain; src/persistence maps them to ImportError codes (T-102). */
export type DecodeErrorCode = 'INVALID_CONTENT' | 'NEWER_VERSION' | 'MIGRATION_FAILED' | 'REFERENCE_INVALID';

export interface DecodeErrorInit {
  readonly code: DecodeErrorCode;
  /** Up to five validation issues as `path: message`. */
  readonly details?: readonly string[];
  readonly fileVersion?: number;
  readonly supportedVersion?: number;
}

/** A document that could not be migrated, validated or verified; the domain never throws for damaged input. */
export class DecodeError extends Error {
  readonly code: DecodeErrorCode;
  readonly details: readonly string[];
  readonly fileVersion?: number;
  readonly supportedVersion?: number;

  constructor({ code, details = [], fileVersion, supportedVersion }: DecodeErrorInit) {
    super(details[0] ?? code);
    this.name = 'DecodeError';
    this.code = code;
    this.details = details;
    this.fileVersion = fileVersion;
    this.supportedVersion = supportedVersion;
  }
}

export type DecodeResult =
  | { readonly ok: true; readonly doc: DesignDocument }
  | { readonly ok: false; readonly error: DecodeError };

function formatIssues(issues: readonly { path: readonly PropertyKey[]; message: string }[]): string[] {
  return issues.slice(0, MAX_REPORTED_ISSUES).map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`);
}

function referenceDetails(references: ReturnType<typeof checkReferences>): string[] {
  return references
    .slice(0, MAX_REPORTED_ISSUES)
    .map((i) => `${i.target.field ?? ''}: ${String(i.params.reason)} ${String(i.params.ref)}`);
}

/**
 * The single decode pipeline shared by file import, stored records and the server (plan §3.4 item 7):
 * migrate → designDocumentSchema → checkReferences. Damaged input returns a DecodeError, never a throw.
 */
export function decodeDesign(raw: unknown, migrations: Migrations = MIGRATIONS): DecodeResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: new DecodeError({ code: 'INVALID_CONTENT', details: ['(root): must be an object'] }) };
  }

  const fileVersion = schemaVersionOf(raw);
  if (fileVersion === null) {
    return { ok: false, error: new DecodeError({ code: 'INVALID_CONTENT', details: ['schemaVersion: must be an integer'] }) };
  }
  if (fileVersion > SCHEMA_VERSION) {
    return { ok: false, error: new DecodeError({ code: 'NEWER_VERSION', fileVersion, supportedVersion: SCHEMA_VERSION }) };
  }

  let migrated: Record<string, unknown>;
  try {
    migrated = migrate(raw as Record<string, unknown>, migrations);
  } catch (error) {
    return {
      ok: false,
      error: new DecodeError({
        code: 'MIGRATION_FAILED',
        details: [error instanceof Error ? error.message : String(error)],
      }),
    };
  }

  const parsed = designDocumentSchema.safeParse(migrated);
  if (!parsed.success) {
    return { ok: false, error: new DecodeError({ code: 'INVALID_CONTENT', details: formatIssues(parsed.error.issues) }) };
  }
  const references = checkReferences(parsed.data);
  if (references.length > 0) {
    return { ok: false, error: new DecodeError({ code: 'REFERENCE_INVALID', details: referenceDetails(references) }) };
  }

  return { ok: true, doc: parsed.data };
}
