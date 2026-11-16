import type { DesignDocument, FurnitureModel, MaterialGroup, ValidationIssue } from '@/domain';
import { CARCASS_SELECTION, HARDWARE_SELECTION, ownerSelection, type Selection } from './selectors';

export interface IssueNavigation {
  selection: Selection | null;
  fieldId: string | null;
}

const SECTION_FIELDS: Record<string, string> = {
  height: 'field-section-height',
  interior: 'field-section-interior',
  fixed: 'field-section-interior',
  adjustable: 'field-section-interior',
  front: 'field-section-front',
};

function materialGroupOf(doc: DesignDocument, materialId: string): MaterialGroup | null {
  const entry = Object.entries(doc.carcass.materialIds).find(([, id]) => id === materialId);
  return entry ? (entry[0] as MaterialGroup) : null;
}

/** Where activating a validation entry leads: the owning outline node and the field to focus (AC-024). */
export function issueNavigation(doc: DesignDocument, model: FurnitureModel | null, issue: ValidationIssue): IssueNavigation {
  const { kind, id, field } = issue.target;
  switch (kind) {
    case 'carcass':
      return { selection: CARCASS_SELECTION, fieldId: field ? `field-carcass-${field}` : null };
    case 'column':
      return { selection: { kind: 'column', id }, fieldId: 'field-column-width' };
    case 'section':
      return { selection: { kind: 'section', id }, fieldId: (field && SECTION_FIELDS[field]) ?? 'field-section-height' };
    case 'drawer':
      return { selection: { kind: 'drawer', id }, fieldId: field ? `field-drawer-${field}` : null };
    case 'profile':
      return { selection: HARDWARE_SELECTION, fieldId: `field-profile-${id}` };
    case 'material': {
      const group = materialGroupOf(doc, id);
      return { selection: CARCASS_SELECTION, fieldId: group ? `field-carcass-material-${group}` : null };
    }
    case 'part': {
      const part = model?.parts.find((p) => p.id === id);
      if (!part) return { selection: null, fieldId: null };
      const group = materialGroupOf(doc, part.materialId);
      const selection = ownerSelection(doc, part);
      return {
        selection,
        fieldId: selection.kind === 'carcass' && group ? `field-carcass-material-${group}` : null,
      };
    }
    default:
      return { selection: CARCASS_SELECTION, fieldId: null };
  }
}
