import type { DesignDocument } from '../document/types';
import type { IdSource } from '../ids';
import { makeColumn, makeDocument, templateCarcass } from './builders';

/** 600 × 720 × 400, no plinth, one empty section. */
export function createBlank(newId: IdSource, nowIso: string, name: string): DesignDocument {
  return makeDocument(newId, nowIso, name, templateCarcass(600, 720, 400, { kind: 'none' }), () => [
    makeColumn(newId, [{}]),
  ]);
}
