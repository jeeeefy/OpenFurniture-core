import { checkReferences } from '../document/references';
import { designDocumentSchema } from '../document/schema';
import type { Column, DesignDocument, Section } from '../document/types';

export const OP_REJECTIONS = [
  'out-of-range',
  'max-columns',
  'last-column',
  'max-sections',
  'no-section-above',
  'drawers-present',
  'interior-not-empty',
  'max-drawers',
  'unknown-material',
  'unknown-handle',
  'material-in-use',
  'max-materials',
  'invalid-name',
  'not-found',
  'front-overlap',
] as const;

export type OpRejection = (typeof OP_REJECTIONS)[number];

export type OpResult = { ok: true; doc: DesignDocument } | { ok: false; reason: OpRejection };

export type Operation<A> = (doc: DesignDocument, args: A) => OpResult;

export const reject = (reason: OpRejection): OpResult => ({ ok: false, reason });

/**
 * Runs `mutate` on a deep copy, so the input is never changed, and rejects any result that is
 * not a schema-valid, referentially consistent document.
 */
export function apply(doc: DesignDocument, mutate: (draft: DesignDocument) => OpRejection | undefined): OpResult {
  const draft = structuredClone(doc);
  const rejection = mutate(draft);
  if (rejection) return reject(rejection);
  if (!designDocumentSchema.safeParse(draft).success || checkReferences(draft).length > 0) return reject('out-of-range');
  return { ok: true, doc: draft };
}

export interface SectionRef {
  column: Column;
  section: Section;
  columnIndex: number;
  sectionIndex: number;
}

export function findSection(doc: DesignDocument, sectionId: string): SectionRef | null {
  for (const [columnIndex, column] of doc.layout.columns.entries()) {
    const sectionIndex = column.sections.findIndex((s) => s.id === sectionId);
    const section = column.sections[sectionIndex];
    if (section) return { column, section, columnIndex, sectionIndex };
  }
  return null;
}

export function findColumn(doc: DesignDocument, columnId: string): Column | null {
  return doc.layout.columns.find((c) => c.id === columnId) ?? null;
}
