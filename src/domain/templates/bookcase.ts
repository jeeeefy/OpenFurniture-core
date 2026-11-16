import type { DesignDocument } from '../document/types';
import type { IdSource } from '../ids';
import { makeColumn, makeDocument, templateCarcass } from './builders';

/** 800 × 2000 × 300, no plinth; col 1: 5 empty sections; col 2: 1 section with 4 adjustable shelves. */
export function createBookcase(newId: IdSource, nowIso: string, name: string): DesignDocument {
  return makeDocument(newId, nowIso, name, templateCarcass(800, 2000, 300, { kind: 'none' }), () => [
    makeColumn(newId, [{}, {}, {}, {}, {}]),
    makeColumn(newId, [{ interior: { kind: 'adjustableShelves', count: 4 } }]),
  ]);
}
