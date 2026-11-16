import { describe, expect, it } from 'vitest';
import {
  checkReferences,
  createDesign,
  designDocumentSchema,
  presetHardware,
  TEMPLATE_IDS,
  type DesignDocument,
} from '@/domain';
import { counterIds, NOW } from '../helpers';

function bookcase(): DesignDocument {
  return createDesign('bookcase', counterIds(), NOW, 'Bookcase');
}

function clone(doc: DesignDocument): DesignDocument {
  return structuredClone(doc);
}

describe('templates (T-003)', () => {
  it.each(TEMPLATE_IDS)('%s parses against the strict schema', (template) => {
    const doc = createDesign(template, counterIds(), NOW, 'Test');
    expect(designDocumentSchema.safeParse(doc).success).toBe(true);
    expect(checkReferences(doc)).toEqual([]);
  });

  it('createDesign is deterministic for injected ids and time', () => {
    const a = createDesign('bookcase', counterIds(), NOW, 'Shelf');
    const b = createDesign('bookcase', counterIds(), NOW, 'Shelf');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.id).toBe('id-1');
    expect(a.createdAt).toBe(NOW);
    expect(a.updatedAt).toBe(NOW);
  });

  it('bookcase matches plan §4.9', () => {
    const doc = bookcase();
    expect(doc.carcass).toMatchObject({ widthMm: 800, heightMm: 2000, depthMm: 300, base: { kind: 'none' } });
    expect(doc.layout.columns).toHaveLength(2);
    const [col1, col2] = doc.layout.columns;
    expect(col1?.sections).toHaveLength(5);
    expect(col1?.sections.every((s) => s.interior.kind === 'empty' && s.front.kind === 'none')).toBe(true);
    expect(col2?.sections).toHaveLength(1);
    expect(col2?.sections[0]?.interior).toEqual({ kind: 'adjustableShelves', count: 4 });
    expect(doc.carcass.materialIds).toEqual({
      carcass: 'mat-ply-18',
      shelves: 'mat-ply-18',
      back: 'mat-hdf-3',
      fronts: 'mat-ply-18',
      drawerBox: 'mat-ply-15',
      drawerBottom: 'mat-ply-9',
      plinth: 'mat-ply-18',
    });
  });

  it('blank matches plan §4.9', () => {
    const doc = createDesign('blank', counterIds(), NOW, 'Blank');
    expect(doc.carcass).toMatchObject({ widthMm: 600, heightMm: 720, depthMm: 400, base: { kind: 'none' } });
    expect(doc.layout.columns).toHaveLength(1);
    expect(doc.layout.columns[0]?.sections).toHaveLength(1);
  });

  it('every design gets its own copy of presets', () => {
    const a = bookcase();
    const b = bookcase();
    expect(a.materials).not.toBe(b.materials);
    expect(a.hardware.hinge).not.toBe(b.hardware.hinge);
    a.hardware.hinge.verifiedByUser = true;
    expect(b.hardware.hinge.verifiedByUser).toBe(false);
    expect(presetHardware().hinge.verifiedByUser).toBe(false);
  });
});

describe('strict schema (T-003)', () => {
  const rejects = (mutate: (doc: Record<string, unknown> & DesignDocument) => void) => {
    const doc = clone(bookcase()) as Record<string, unknown> & DesignDocument;
    mutate(doc);
    return !designDocumentSchema.safeParse(doc).success;
  };

  it('rejects unknown keys at every level', () => {
    expect(rejects((d) => (d.extra = 1))).toBe(true);
    expect(rejects((d) => Object.assign(d.carcass, { colour: 'red' }))).toBe(true);
    expect(rejects((d) => Object.assign(d.layout.columns[0]!.sections[0]!, { note: 'x' }))).toBe(true);
    expect(rejects((d) => Object.assign(d.hardware.hinge, { brand: 'x' }))).toBe(true);
    expect(rejects((d) => Object.assign(d.construction, { foo: 1 }))).toBe(true);
  });

  it('rejects out-of-range and non-finite numbers', () => {
    expect(rejects((d) => (d.carcass.widthMm = 150))).toBe(true);
    expect(rejects((d) => (d.carcass.widthMm = 2500))).toBe(true);
    expect(rejects((d) => (d.carcass.heightMm = 2601))).toBe(true);
    expect(rejects((d) => (d.carcass.depthMm = 149))).toBe(true);
    expect(rejects((d) => (d.carcass.widthMm = Number.NaN))).toBe(true);
    expect(rejects((d) => (d.carcass.widthMm = Number.POSITIVE_INFINITY))).toBe(true);
    expect(rejects((d) => (d.materials[0]!.thicknessMm = 1))).toBe(true);
    expect(rejects((d) => (d.construction.spareFactor = 1.5))).toBe(true);
    expect(rejects((d) => (d.hardware.hinge.cupDiameterMm = 41))).toBe(true);
    expect(rejects((d) => (d.hardware.plinthBracket.screwsPerBracket = 9))).toBe(true);
    expect(rejects((d) => (d.hardware.shelfPin.pinsPerShelf = 2.5))).toBe(true);
    expect(rejects((d) => (d.carcass.widthMm = 2400))).toBe(false);
  });

  it('rejects more than 6 columns, 8 sections, 6 drawers and 10 shelves', () => {
    expect(
      rejects((d) => {
        const col = d.layout.columns[0]!;
        d.layout.columns = Array.from({ length: 7 }, (_, i) => ({ ...col, id: `c${i}` }));
      }),
    ).toBe(true);
    expect(
      rejects((d) => {
        const sec = d.layout.columns[0]!.sections[0]!;
        d.layout.columns[0]!.sections = Array.from({ length: 9 }, (_, i) => ({ ...sec, id: `s${i}` }));
      }),
    ).toBe(true);
    expect(
      rejects((d) => {
        d.layout.columns[0]!.sections[0]!.front = {
          kind: 'drawers',
          handleId: null,
          drawers: Array.from({ length: 7 }, (_, i) => ({ id: `d${i}`, frontHeight: { mode: 'auto' as const } })),
        };
      }),
    ).toBe(true);
    expect(rejects((d) => (d.layout.columns[1]!.sections[0]!.interior = { kind: 'adjustableShelves', count: 11 }))).toBe(
      true,
    );
    expect(rejects((d) => (d.layout.columns = []))).toBe(true);
  });

  it('enforces array ordering and profile consistency', () => {
    expect(rejects((d) => (d.hardware.slide.lengthsMm = [300, 250]))).toBe(true);
    expect(rejects((d) => (d.hardware.slide.lengthsMm = [300, 300]))).toBe(true);
    expect(rejects((d) => (d.hardware.slide.lengthsMm = [100]))).toBe(true);
    expect(rejects((d) => (d.hardware.hinge.countByHeight = [{ maxDoorHeightMm: 900, count: 1 }]))).toBe(true);
    expect(rejects((d) => (d.hardware.hinge.overlayRangesMm.full = [18, 14]))).toBe(true);
    expect(rejects((d) => (d.hardware.handles[0]!.centerDistanceMm = null))).toBe(true);
    expect(rejects((d) => (d.hardware.handles[0]!.screwLengthsMm = [90]))).toBe(true);
    expect(rejects((d) => (d.name = '   '))).toBe(true);
    expect(rejects((d) => (d.name = 'x'.repeat(81)))).toBe(true);
    expect(rejects((d) => (d.hardware.hinge.sourceNote = 'x'.repeat(201)))).toBe(true);
    expect(rejects((d) => ((d as { schemaVersion: number }).schemaVersion = 2))).toBe(true);
  });
});

describe('checkReferences (T-003)', () => {
  it('reports unresolved material ids as REFERENCE_INVALID', () => {
    const doc = clone(bookcase());
    doc.carcass.materialIds.back = 'mat-missing';
    const issues = checkReferences(doc);
    expect(issues).toEqual([
      {
        code: 'REFERENCE_INVALID',
        severity: 'error',
        target: { kind: 'design', id: doc.id, field: 'carcass.materialIds.back' },
        params: { reason: 'unresolved', ref: 'mat-missing' },
      },
    ]);
  });

  it('reports unresolved handles and duplicate ids', () => {
    const doc = clone(bookcase());
    doc.layout.columns[0]!.sections[0]!.front = { kind: 'door', hinge: 'left', handleId: 'h-missing' };
    doc.layout.columns[1]!.sections[0]!.id = doc.layout.columns[0]!.id;
    doc.materials[1]!.id = doc.materials[0]!.id;
    const issues = checkReferences(doc);
    expect(issues.map((i) => i.params)).toEqual([
      { reason: 'duplicate', ref: doc.layout.columns[0]!.id },
      { reason: 'duplicate', ref: 'mat-ply-18' },
      // Renaming mat-ply-15 also leaves the drawer-box assignment dangling.
      { reason: 'unresolved', ref: 'mat-ply-15' },
      { reason: 'unresolved', ref: 'h-missing' },
    ]);
    expect(issues.every((i) => i.code === 'REFERENCE_INVALID' && i.severity === 'error')).toBe(true);
  });
});
