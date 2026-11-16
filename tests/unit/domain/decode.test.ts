import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createDesign, decodeDesign, DecodeError, SCHEMA_VERSION, type Migrations } from '@/domain';
import { counterIds, NOW } from '../helpers';

const design = () => createDesign('bookcase', counterIds(), NOW, 'Bookcase');
const rawDesign = () => structuredClone(design()) as unknown as Record<string, unknown>;

function decodeError(value: unknown, migrations?: Migrations): DecodeError {
  const result = decodeDesign(value, migrations);
  if (result.ok) throw new Error('expected decode to fail');
  return result.error;
}

function fixture(name: string): { format: string; design: unknown } {
  return JSON.parse(readFileSync(new URL(`../../fixtures/${name}`, import.meta.url), 'utf8')) as {
    format: string;
    design: unknown;
  };
}

describe('decodeDesign (T-102)', () => {
  it('returns the validated document for a valid design', () => {
    const doc = design();
    expect(decodeDesign(doc)).toEqual({ ok: true, doc });
  });

  it('reports NEWER_VERSION with both versions', () => {
    const error = decodeError({ ...rawDesign(), schemaVersion: SCHEMA_VERSION + 1 });
    expect(error).toBeInstanceOf(DecodeError);
    expect(error.name).toBe('DecodeError');
    expect(error.code).toBe('NEWER_VERSION');
    expect(error.fileVersion).toBe(SCHEMA_VERSION + 1);
    expect(error.supportedVersion).toBe(SCHEMA_VERSION);
    expect(error.details).toEqual([]);
  });

  it('reports MIGRATION_FAILED when a migration is missing, throws or does not advance the version', () => {
    const v0 = { ...rawDesign(), schemaVersion: 0 };
    const missing = decodeError(v0, {});
    expect(missing.code).toBe('MIGRATION_FAILED');
    expect(missing.details[0]).toMatch(/No migration from schemaVersion 0/);

    const throwing = decodeError(v0, {
      0: () => {
        throw new Error('boom');
      },
    });
    expect(throwing.code).toBe('MIGRATION_FAILED');
    expect(throwing.details[0]).toContain('boom');

    const stuck = decodeError(v0, { 0: (doc) => doc });
    expect(stuck.code).toBe('MIGRATION_FAILED');
    expect(stuck.details[0]).toMatch(/did not produce schemaVersion 1/);
  });

  it('applies registered migrations before validation', () => {
    const v0 = { ...rawDesign(), schemaVersion: 0 };
    const result = decodeDesign(v0, {
      0: (doc) => ({ ...doc, schemaVersion: 1 }),
    });
    expect(result.ok && result.doc.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('reports INVALID_CONTENT for unknown keys, invalid numbers and missing versions', () => {
    expect(decodeError({ ...rawDesign(), colour: 'red' }).details[0]).toMatch(/Unrecognized key: "colour"/);

    const negative = rawDesign();
    (negative.carcass as Record<string, unknown>).widthMm = -1;
    expect(decodeError(negative).details[0]).toMatch(/^carcass\.widthMm: /);

    const missing = rawDesign();
    delete missing.schemaVersion;
    const missingError = decodeError(missing);
    expect(missingError.code).toBe('INVALID_CONTENT');
    expect(missingError.details).toEqual(['schemaVersion: must be an integer']);
    expect(decodeError({ ...rawDesign(), schemaVersion: '1' }).code).toBe('INVALID_CONTENT');
    expect(decodeError({ ...rawDesign(), schemaVersion: 1.5 }).code).toBe('INVALID_CONTENT');
  });

  it('reports REFERENCE_INVALID for dangling references', () => {
    const doc = rawDesign();
    (doc.carcass as { materialIds: Record<string, string> }).materialIds.back = 'nope';
    const error = decodeError(doc);
    expect(error.code).toBe('REFERENCE_INVALID');
    expect(error.details[0]).toContain('unresolved nope');
  });

  it('reports at most five issues with paths', () => {
    const doc = rawDesign();
    const carcass = doc.carcass as Record<string, number>;
    carcass.widthMm = -1;
    carcass.heightMm = -1;
    carcass.depthMm = -1;
    const construction = doc.construction as Record<string, number>;
    construction.frontGapMm = -1;
    construction.frontRevealMm = -1;
    construction.spareFactor = 9;
    expect(decodeError(doc).details).toHaveLength(5);
  });

  it.each([
    ['null', null],
    ['a string', '{"schemaVersion":1}'],
    ['a number', 42],
    ['an array', []],
    ['an empty object', {}],
    ['a partial document', { schemaVersion: SCHEMA_VERSION }],
    ['a document with a broken layout', { ...structuredClone(design()), layout: { columns: 'nope' } }],
  ])('treats %s as damaged without throwing', (_label, value) => {
    const error = decodeError(value);
    expect(error).toBeInstanceOf(DecodeError);
    expect(error.code).toBe('INVALID_CONTENT');
  });

  it('decodes the newer-version fixture as NEWER_VERSION', () => {
    const error = decodeError(fixture('newer-version.furniture.json').design);
    expect(error.code).toBe('NEWER_VERSION');
    expect(error.fileVersion).toBe(2);
    expect(error.supportedVersion).toBe(SCHEMA_VERSION);
  });

  it('decodes the prototype-keys fixture as INVALID_CONTENT (unknown key)', () => {
    const { design: parsed } = fixture('prototype-keys.furniture.json');
    expect(Object.keys(parsed as object)).toContain('__proto__');
    expect(decodeError(parsed).code).toBe('INVALID_CONTENT');
  });

  it('decodes the wrong-format fixture design as INVALID_CONTENT (incomplete document)', () => {
    const { design: parsed } = fixture('wrong-format.furniture.json');
    expect(decodeError(parsed).code).toBe('INVALID_CONTENT');
  });
});
