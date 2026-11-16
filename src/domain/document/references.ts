import { issue, type ValidationIssue } from '../validate/catalogue';
import type { DesignDocument, Front } from './types';

function frontHandleId(front: Front): string | null {
  return front.kind === 'none' ? null : front.handleId;
}

/**
 * Referential rules (plan §4.2): material and handle references resolve, and ids are unique
 * across columns, sections, drawers, materials and handles. Returns REFERENCE_INVALID issues.
 */
export function checkReferences(doc: DesignDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const designTarget = (field: string) => ({ kind: 'design' as const, id: doc.id, field });

  const seen = new Set<string>();
  const reported = new Set<string>();
  const claim = (id: string, field: string) => {
    if (seen.has(id)) {
      if (!reported.has(id)) {
        reported.add(id);
        issues.push(issue('REFERENCE_INVALID', designTarget(field), { reason: 'duplicate', ref: id }));
      }
      return;
    }
    seen.add(id);
  };

  doc.layout.columns.forEach((column, c) => {
    claim(column.id, `layout.columns.${c}.id`);
    column.sections.forEach((section, s) => {
      claim(section.id, `layout.columns.${c}.sections.${s}.id`);
      if (section.front.kind === 'drawers') {
        section.front.drawers.forEach((drawer, d) => {
          claim(drawer.id, `layout.columns.${c}.sections.${s}.front.drawers.${d}.id`);
        });
      }
    });
  });
  doc.materials.forEach((material, m) => {
    claim(material.id, `materials.${m}.id`);
  });
  doc.hardware.handles.forEach((handle, h) => {
    claim(handle.id, `hardware.handles.${h}.id`);
  });

  const materialIds = new Set(doc.materials.map((m) => m.id));
  for (const [group, materialId] of Object.entries(doc.carcass.materialIds)) {
    if (!materialIds.has(materialId)) {
      issues.push(
        issue('REFERENCE_INVALID', designTarget(`carcass.materialIds.${group}`), { reason: 'unresolved', ref: materialId }),
      );
    }
  }

  const handleIds = new Set(doc.hardware.handles.map((h) => h.id));
  doc.layout.columns.forEach((column, c) => {
    column.sections.forEach((section, s) => {
      const handleId = frontHandleId(section.front);
      if (handleId !== null && !handleIds.has(handleId)) {
        issues.push(
          issue('REFERENCE_INVALID', designTarget(`layout.columns.${c}.sections.${s}.front.handleId`), {
            reason: 'unresolved',
            ref: handleId,
          }),
        );
      }
    });
  });

  return issues;
}
