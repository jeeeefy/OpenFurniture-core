import { SCHEMA_VERSION } from './limits';

/** Migration n upgrades a document from schemaVersion n to n + 1. */
export type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;
export type Migrations = Readonly<Record<number, Migration>>;

// Schema version 1 is the first version; future migrations are registered here (plan §9.4).
export const MIGRATIONS: Migrations = {};

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

export function schemaVersionOf(raw: unknown): number | null {
  if (typeof raw !== 'object' || raw === null || !('schemaVersion' in raw)) return null;
  const version = raw.schemaVersion;
  return typeof version === 'number' && Number.isInteger(version) ? version : null;
}

/** Applies migrations in ascending order up to the supported version; the result still needs schema validation. */
export function migrate(raw: Record<string, unknown>, migrations: Migrations = MIGRATIONS): Record<string, unknown> {
  const from = schemaVersionOf(raw);
  if (from === null) throw new MigrationError('schemaVersion is missing or not an integer');
  if (from > SCHEMA_VERSION) throw new MigrationError(`schemaVersion ${from} is newer than ${SCHEMA_VERSION}`);
  let doc = raw;
  for (let version = from; version < SCHEMA_VERSION; version += 1) {
    const step = migrations[version];
    if (!step) throw new MigrationError(`No migration from schemaVersion ${version}`);
    try {
      doc = step(structuredClone(doc));
    } catch (error) {
      throw new MigrationError(`Migration ${version} → ${version + 1} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (schemaVersionOf(doc) !== version + 1) throw new MigrationError(`Migration ${version} did not produce schemaVersion ${version + 1}`);
  }
  return doc;
}
