import type { DesignDocument } from '../document/types';
import type { IdSource } from '../ids';
import { createBlank } from './blank';
import { createBookcase } from './bookcase';
import { createCabinet, createChest, createSideboard, createWardrobe } from './fronted';

type TemplateFactory = (newId: IdSource, nowIso: string, name: string) => DesignDocument;

// Order = order of the template cards on the start page.
const TEMPLATES = {
  bookcase: createBookcase,
  cabinet: createCabinet,
  sideboard: createSideboard,
  chest: createChest,
  wardrobe: createWardrobe,
  blank: createBlank,
} satisfies Record<string, TemplateFactory>;

export type TemplateId = keyof typeof TEMPLATES;

export const TEMPLATE_IDS = Object.keys(TEMPLATES) as TemplateId[];

/** Deterministic for a given id source, timestamp and name. */
export function createDesign(template: TemplateId, newId: IdSource, nowIso: string, name: string): DesignDocument {
  return TEMPLATES[template](newId, nowIso, name);
}
