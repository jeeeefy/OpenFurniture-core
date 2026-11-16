import { describe, expect, it } from 'vitest';
import { canonicalJson, createDesign, deriveModel, generateOutputs, SCHEMA_VERSION, type DesignDocument } from '@/domain';
import {
  exportDesignFile,
  exportFileName,
  importDesignFile,
  MAX_FILE_BYTES,
  type ImportContext,
  type ImportResult,
} from '@/persistence/fileFormat';
import { migrate, MigrationError, type Migrations } from '@/persistence/migrations';
import { decodeRecord, toRecord } from '@/persistence/records';
import { counterIds, NOW } from '../helpers';

const LATER = '2026-11-09T12:00:00.000Z';
const ctx = (overrides: Partial<ImportContext> = {}): ImportContext => ({
  existingNames: new Set(),
  newId: 'imported-id',
  nowIso: LATER,
  ...overrides,
});
const file = (text: string, size = text.length) => ({ size, text: () => Promise.resolve(text) });
const design = () => createDesign('bookcase', counterIds(), NOW, 'Bookcase');

function envelopeText(mutate: (env: Record<string, unknown> & { design: Record<string, unknown> }) => void = () => undefined) {
  const env = JSON.parse(exportDesignFile(design(), '0.1.0', NOW).json) as Record<string, unknown> & {
    design: Record<string, unknown>;
  };
  mutate(env);
  // Indented like a real export, so the string replacements below match.
  return JSON.stringify(env, null, 2);
}

async function rejectCode(text: string, size?: number): Promise<string | null> {
  const result: ImportResult = await importDesignFile(file(text, size), ctx());
  return result.ok ? null : result.error.code;
}

function outputs(doc: DesignDocument): string {
  const result = deriveModel(doc);
  if (!result.ok) throw new Error('derive failed');
  return canonicalJson({ model: result.model, outputs: generateOutputs(doc, result.model) });
}

describe('export (T-010)', () => {
  it('writes the envelope with exactly four keys and a slug file name', () => {
    const doc = design();
    const { fileName, json } = exportDesignFile(doc, '0.1.0', NOW);
    expect(fileName).toBe('bookcase.furniture.json');
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual(['format', 'appVersion', 'exportedAt', 'design']);
    expect(parsed.format).toBe('furniture-designer/design');
    expect(json).toContain('\n  "design"');
  });

  it.each([
    ['Hall cabinet #2', 'hall-cabinet-2.furniture.json'],
    ['  Über – Regal  ', 'ber-regal.furniture.json'],
    ['!!!', 'design.furniture.json'],
    ['x'.repeat(80), `${'x'.repeat(60)}.furniture.json`],
  ])('file name for %j', (name, expected) => {
    expect(exportFileName(name)).toBe(expected);
  });
});

describe('import pipeline (AC-042, T-010)', () => {
  it('imports a valid file with a new id, new timestamps and identical outputs', async () => {
    const original = design();
    const result = await importDesignFile(file(exportDesignFile(original, '0.1.0', NOW).json), ctx());
    if (!result.ok) throw new Error(result.error.code);
    expect(result.doc).toMatchObject({ id: 'imported-id', name: 'Bookcase', createdAt: LATER, updatedAt: LATER });
    expect(outputs(result.doc)).toBe(outputs(original));
  });

  it('appends " (imported)" on a name clash (AC-043)', async () => {
    const result = await importDesignFile(file(envelopeText()), ctx({ existingNames: new Set(['Bookcase']) }));
    expect(result.ok && result.doc.name).toBe('Bookcase (imported)');
    const long = await importDesignFile(
      file(envelopeText((e) => (e.design.name = 'n'.repeat(80)))),
      ctx({ existingNames: new Set(['n'.repeat(80)]) }),
    );
    expect(long.ok && long.doc.name).toHaveLength(80);
  });

  it('rejects files larger than 1 MiB', async () => {
    expect(await rejectCode('{}', MAX_FILE_BYTES + 1)).toBe('FILE_TOO_LARGE');
  });

  it('rejects invalid JSON and forbidden keys', async () => {
    expect(await rejectCode('{ not json')).toBe('NOT_JSON');
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      expect(await rejectCode(envelopeText().replace('"carcass": {', `"carcass": { "${key}": {},`))).toBe('FORBIDDEN_KEY');
      expect(await rejectCode(envelopeText().replace('{', `{ "${key}": 1,`))).toBe('FORBIDDEN_KEY');
    }
  });

  it('rejects unknown or missing envelope keys and a wrong format', async () => {
    expect(await rejectCode(envelopeText((e) => (e.extra = 1)))).toBe('INVALID_CONTENT');
    expect(await rejectCode(envelopeText((e) => delete e.exportedAt))).toBe('INVALID_CONTENT');
    expect(await rejectCode(envelopeText((e) => delete (e as Partial<typeof e>).design))).toBe('INVALID_CONTENT');
    expect(await rejectCode(envelopeText((e) => (e.format = 'other/thing')))).toBe('WRONG_FORMAT');
    expect(await rejectCode('[]')).toBe('INVALID_CONTENT');
  });

  it('rejects a newer schemaVersion and names both versions', async () => {
    const result = await importDesignFile(file(envelopeText((e) => (e.design.schemaVersion = 7))), ctx());
    expect(result).toEqual({
      ok: false,
      error: { code: 'NEWER_VERSION', details: [], fileVersion: 7, supportedVersion: SCHEMA_VERSION },
    });
  });

  it('rejects unknown design keys, non-finite or out-of-range numbers and oversized arrays', async () => {
    expect(await rejectCode(envelopeText((e) => (e.design.colour = 'red')))).toBe('INVALID_CONTENT');
    expect(await rejectCode(envelopeText().replace('"widthMm": 800', '"widthMm": 1e999'))).toBe('INVALID_CONTENT');
    expect(await rejectCode(envelopeText().replace('"widthMm": 800', '"widthMm": 5000'))).toBe('INVALID_CONTENT');
    expect(
      await rejectCode(
        envelopeText((e) => {
          const layout = e.design.layout as { columns: unknown[] };
          layout.columns = Array.from({ length: 50 }, () => layout.columns[0]);
        }),
      ),
    ).toBe('INVALID_CONTENT');
    expect(await rejectCode(envelopeText((e) => (e.design.schemaVersion = '1')))).toBe('INVALID_CONTENT');
  });

  it('reports at most five validation issues with paths', async () => {
    const result = await importDesignFile(
      file(
        envelopeText((e) => {
          const carcass = e.design.carcass as Record<string, number>;
          carcass.widthMm = -1;
          carcass.heightMm = -1;
          carcass.depthMm = -1;
          const c = e.design.construction as Record<string, number>;
          c.frontGapMm = -1;
          c.frontRevealMm = -1;
          c.spareFactor = 9;
        }),
      ),
      ctx(),
    );
    expect(!result.ok && result.error.details).toHaveLength(5);
    expect(!result.ok && result.error.details[0]).toMatch(/^design\.carcass\.widthMm: |^carcass\.widthMm: /);
  });

  it('rejects dangling references', async () => {
    expect(
      await rejectCode(envelopeText((e) => ((e.design.carcass as { materialIds: { back: string } }).materialIds.back = 'nope'))),
    ).toBe('REFERENCE_INVALID');
  });
});

describe('migrations (AC-043, T-010)', () => {
  // Synthetic v0 → v1 migration: v0 stored the overall width as `width` instead of `widthMm`.
  const v0Migrations: Migrations = {
    0: (doc) => {
      const carcass = doc.carcass as Record<string, unknown>;
      const { width, ...rest } = carcass;
      return { ...doc, schemaVersion: 1, carcass: { ...rest, widthMm: width } };
    },
  };
  const v0Design = () => {
    const doc = design() as unknown as Record<string, unknown>;
    const carcass = doc.carcass as Record<string, unknown>;
    const { widthMm, ...rest } = carcass;
    return { ...doc, schemaVersion: 0, carcass: { ...rest, width: widthMm } };
  };

  it('applies registered migrations in ascending order and validates the result', async () => {
    const env = JSON.parse(exportDesignFile(design(), '0.0.1', NOW).json) as Record<string, unknown>;
    env.design = v0Design();
    const result = await importDesignFile(file(JSON.stringify(env)), ctx({ migrations: v0Migrations }));
    expect(result.ok && result.doc.carcass.widthMm).toBe(800);
    expect(result.ok && result.doc.schemaVersion).toBe(1);
  });

  it('fails with MIGRATION_FAILED when no migration is registered or it throws', async () => {
    const env = JSON.parse(exportDesignFile(design(), '0.0.1', NOW).json) as Record<string, unknown>;
    env.design = v0Design();
    const missing = await importDesignFile(file(JSON.stringify(env)), ctx({ migrations: {} }));
    expect(!missing.ok && missing.error.code).toBe('MIGRATION_FAILED');
    const throwing = await importDesignFile(
      file(JSON.stringify(env)),
      ctx({
        migrations: {
          0: () => {
            throw new Error('boom');
          },
        },
      }),
    );
    expect(!throwing.ok && throwing.error.code).toBe('MIGRATION_FAILED');
    expect(() => migrate({ schemaVersion: 0 }, { 0: (d) => d })).toThrow(MigrationError);
  });

  it('migrates stored records on load and reports unmigratable ones as damaged', () => {
    const record = { ...toRecord(design(), 3), document: v0Design() };
    expect(decodeRecord(record, v0Migrations)).toMatchObject({ status: 'ok', revision: 3, document: { carcass: { widthMm: 800 } } });
    expect(decodeRecord(record, {})).toMatchObject({ status: 'damaged', revision: 3 });
    expect(decodeRecord({ ...record, document: { ...design(), schemaVersion: 9 } })).toMatchObject({ status: 'damaged' });
  });
});
