import {
  decodeDesign,
  DecodeError,
  DESIGN_FILE_FORMAT,
  designFileEnvelopeSchema,
  LIMITS,
  type DesignDocument,
} from '@/domain';
import { MIGRATIONS, type Migrations } from './migrations';

export const MAX_FILE_BYTES = 1024 * 1024;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_REPORTED_ISSUES = 5;
export const IMPORTED_SUFFIX = ' (imported)';

export type ImportErrorCode =
  | 'FILE_TOO_LARGE'
  | 'NOT_JSON'
  | 'FORBIDDEN_KEY'
  | 'INVALID_CONTENT'
  | 'WRONG_FORMAT'
  | 'NEWER_VERSION'
  | 'MIGRATION_FAILED'
  | 'REFERENCE_INVALID';

export interface ImportError {
  code: ImportErrorCode;
  /** Up to five validation issues as `path: message`. */
  details: string[];
  fileVersion?: number;
  supportedVersion?: number;
}

export type ImportResult = { ok: true; doc: DesignDocument } | { ok: false; error: ImportError };

export interface ImportContext {
  existingNames: ReadonlySet<string>;
  newId: string;
  nowIso: string;
  migrations?: Migrations;
}

export interface ReadableFile {
  size: number;
  text(): Promise<string>;
}

const fail = (code: ImportErrorCode, details: string[] = [], extra: Partial<ImportError> = {}): ImportResult => ({
  ok: false,
  error: { code, details, ...extra },
});

/** Maps a domain DecodeError onto the import error shape without changing codes or details (T-102). */
function toImportError(error: DecodeError): ImportError {
  return {
    code: error.code,
    details: [...error.details],
    ...(error.fileVersion === undefined ? {} : { fileVersion: error.fileVersion }),
    ...(error.supportedVersion === undefined ? {} : { supportedVersion: error.supportedVersion }),
  };
}

class ForbiddenKeyError extends Error {}

function parseJson(text: string): unknown {
  return JSON.parse(text, function reviver(key, value: unknown) {
    if (FORBIDDEN_KEYS.has(key)) throw new ForbiddenKeyError(key);
    return value;
  });
}

function formatIssues(issues: readonly { path: readonly PropertyKey[]; message: string }[]): string[] {
  return issues.slice(0, MAX_REPORTED_ISSUES).map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`);
}

export function uniqueImportedName(name: string, existing: ReadonlySet<string>): string {
  if (!existing.has(name)) return name;
  return `${name.slice(0, LIMITS.name.max - IMPORTED_SUFFIX.length)}${IMPORTED_SUFFIX}`;
}

/** Plan §5.2 import pipeline; any failure returns an error and has no side effects. */
export async function importDesignFile(file: ReadableFile, ctx: ImportContext): Promise<ImportResult> {
  if (file.size > MAX_FILE_BYTES) return fail('FILE_TOO_LARGE');
  const text = await file.text();
  if (text.length > MAX_FILE_BYTES) return fail('FILE_TOO_LARGE');

  let raw: unknown;
  try {
    raw = parseJson(text);
  } catch (error) {
    return error instanceof ForbiddenKeyError ? fail('FORBIDDEN_KEY', [error.message]) : fail('NOT_JSON');
  }

  const envelope = designFileEnvelopeSchema.safeParse(raw);
  if (!envelope.success) return fail('INVALID_CONTENT', formatIssues(envelope.error.issues));
  if (envelope.data.format !== DESIGN_FILE_FORMAT) return fail('WRONG_FORMAT');

  const decoded = decodeDesign(envelope.data.design, ctx.migrations ?? MIGRATIONS);
  if (!decoded.ok) return { ok: false, error: toImportError(decoded.error) };

  return {
    ok: true,
    doc: {
      ...decoded.doc,
      id: ctx.newId,
      name: uniqueImportedName(decoded.doc.name, ctx.existingNames),
      createdAt: ctx.nowIso,
      updatedAt: ctx.nowIso,
    },
  };
}

export function exportFileName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return `${slug || 'design'}.furniture.json`;
}

/** Pretty-printed export envelope (plan §5.2); `exportedAt` is the only volatile field. */
export function exportDesignFile(doc: DesignDocument, appVersion: string, exportedAt: string): { fileName: string; json: string } {
  const envelope = { format: DESIGN_FILE_FORMAT, appVersion, exportedAt, design: doc };
  return { fileName: exportFileName(doc.name), json: JSON.stringify(envelope, null, 2) };
}
