import {
  deriveModel,
  generateOutputs,
  hasErrors,
  type DeriveResult,
  type DesignDocument,
  type FurnitureModel,
  type Outputs,
  type Part,
} from '@/domain';

export type SelectionKind = 'carcass' | 'plinth' | 'column' | 'section' | 'drawer' | 'materials' | 'hardware' | 'banding';

export interface Selection {
  kind: SelectionKind;
  id: string;
}

export const CARCASS_SELECTION: Selection = { kind: 'carcass', id: 'carcass' };
export const PLINTH_SELECTION: Selection = { kind: 'plinth', id: 'plinth' };
export const MATERIALS_SELECTION: Selection = { kind: 'materials', id: 'materials' };
export const HARDWARE_SELECTION: Selection = { kind: 'hardware', id: 'hardware' };
export const BANDING_SELECTION: Selection = { kind: 'banding', id: 'banding' };

const deriveCache = new WeakMap<DesignDocument, DeriveResult>();
const outputsCache = new WeakMap<FurnitureModel, Outputs>();

/** Memoised by document identity; every committed edit creates a new document. */
export function selectDerived(doc: DesignDocument): DeriveResult {
  let result = deriveCache.get(doc);
  if (!result) {
    result = deriveModel(doc);
    deriveCache.set(doc, result);
  }
  return result;
}

/** Outputs only exist for models without errors (ADR-10). */
export function selectOutputs(doc: DesignDocument): Outputs | null {
  const derived = selectDerived(doc);
  if (!derived.ok || hasErrors(derived.model.issues)) return null;
  let outputs = outputsCache.get(derived.model);
  if (!outputs) {
    outputs = generateOutputs(doc, derived.model);
    outputsCache.set(derived.model, outputs);
  }
  return outputs;
}

function sectionOfDrawer(doc: DesignDocument, drawerId: string): string | null {
  for (const column of doc.layout.columns) {
    for (const section of column.sections) {
      if (section.front.kind === 'drawers' && section.front.drawers.some((d) => d.id === drawerId)) return section.id;
    }
  }
  return null;
}

/** Plan §6.2: the outline node a clicked part selects. */
export function ownerSelection(doc: DesignDocument, part: Part): Selection {
  switch (part.role) {
    case 'side-left':
    case 'side-right':
    case 'top':
    case 'bottom':
    case 'back':
      return CARCASS_SELECTION;
    case 'plinth-side':
    case 'plinth-front':
    case 'plinth-back':
      return PLINTH_SELECTION;
    case 'divider':
      return { kind: 'column', id: part.ownerId };
    case 'drawer-front':
    case 'drawer-side':
    case 'drawer-inner-front':
    case 'drawer-inner-back':
    case 'drawer-bottom':
      return { kind: 'section', id: sectionOfDrawer(doc, part.ownerId) ?? part.ownerId };
    default:
      return { kind: 'section', id: part.ownerId };
  }
}

/** Parts highlighted for an outline node; a column includes its divider and its sections' parts. */
export function partsOfSelection(doc: DesignDocument, model: FurnitureModel, selection: Selection): string[] {
  if (selection.kind === 'drawer') {
    return model.parts.filter((p) => p.id.startsWith(`drw:${selection.id}:`)).map((p) => p.id);
  }
  if (selection.kind === 'column') {
    const column = doc.layout.columns.find((c) => c.id === selection.id);
    const sectionIds = new Set(column?.sections.map((s) => s.id) ?? []);
    return model.parts
      .filter((p) => {
        const owner = ownerSelection(doc, p);
        return (owner.kind === 'column' && owner.id === selection.id) || (owner.kind === 'section' && sectionIds.has(owner.id));
      })
      .map((p) => p.id);
  }
  return model.parts
    .filter((p) => {
      const owner = ownerSelection(doc, p);
      return owner.kind === selection.kind && owner.id === selection.id;
    })
    .map((p) => p.id);
}

/** True if the selected node still exists in the document. */
export function selectionExists(doc: DesignDocument, selection: Selection): boolean {
  switch (selection.kind) {
    case 'carcass':
    case 'materials':
    case 'hardware':
    case 'banding':
      return true;
    case 'plinth':
      return doc.carcass.base.kind === 'plinth';
    case 'column':
      return doc.layout.columns.some((c) => c.id === selection.id);
    case 'section':
      return doc.layout.columns.some((c) => c.sections.some((s) => s.id === selection.id));
    case 'drawer':
      return sectionOfDrawer(doc, selection.id) !== null;
  }
}
