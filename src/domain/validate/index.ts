import type { DesignDocument } from '../document/types';
import { LIMITS } from '../document/limits';
import type { DeriveContext } from '../derive/context';
import { cutSize } from '../derive/frames';
import type { Part } from '../derive/model';
import { CARCASS_TARGET_ID, materialById } from '../layout/resolveLayout';
import { frontSpan } from '../layout/frontGrid';
import { EPS } from '../units';
import { issue, type ValidationIssue } from './catalogue';

/** Checks on the document alone; they apply even when the layout cannot be resolved. */
export function checkDocument(doc: DesignDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const back = materialById(doc, doc.carcass.materialIds.back);
  if (back && (back.thicknessMm < LIMITS.backThickness.min || back.thicknessMm > LIMITS.backThickness.max)) {
    issues.push(
      issue('BACK_THICKNESS_OUT_OF_RANGE', { kind: 'material', id: back.id, field: 'thicknessMm' }, {
        thicknessMm: back.thicknessMm,
        minMm: LIMITS.backThickness.min,
        maxMm: LIMITS.backThickness.max,
      }),
    );
  }
  if (doc.carcass.heightMm >= doc.construction.tallFurnitureHeightMm) {
    issues.push(
      issue('TALL_FURNITURE_ANCHOR', { kind: 'carcass', id: CARCASS_TARGET_ID, field: 'heightMm' }, {
        heightMm: doc.carcass.heightMm,
      }),
    );
  }
  for (const column of doc.layout.columns) {
    column.sections.forEach((section, si) => {
      if (section.front.kind === 'drawers' && section.interior.kind !== 'empty') {
        issues.push(issue('DRAWER_INTERIOR_CONFLICT', { kind: 'section', id: section.id, field: 'interior' }));
      }
      const span = frontSpan(section);
      if (span > 1) {
        const available = column.sections.length - si;
        const overlap = column.sections.slice(si + 1, si + span).some((s) => s.front.kind !== 'none');
        if (span > available || overlap) {
          issues.push(issue('FRONT_SPAN_INVALID', { kind: 'section', id: section.id, field: 'front' }, { span, availableSections: available }));
        }
      }
    });
  }
  return issues;
}

function checkSheets(ctx: DeriveContext, parts: readonly Part[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const part of parts) {
    const material = materialById(ctx.doc, part.materialId);
    if (!material) continue;
    const cut = cutSize(part, material);
    const { lengthMm: sL, widthMm: sW } = material.sheet;
    const fits = (s: { lengthMm: number; widthMm: number }) =>
      (cut.lengthMm <= s.lengthMm + EPS && cut.widthMm <= s.widthMm + EPS) ||
      (!material.hasGrain && cut.lengthMm <= s.widthMm + EPS && cut.widthMm <= s.lengthMm + EPS);
    if (![material.sheet, ...(material.extraSheets ?? [])].some(fits)) {
      issues.push(
        issue('PART_EXCEEDS_SHEET', { kind: 'part', id: part.id }, {
          lengthMm: cut.lengthMm,
          widthMm: cut.widthMm,
          sheetLengthMm: sL,
          sheetWidthMm: sW,
          materialId: material.id,
        }),
      );
    }
  }
  return issues;
}

function checkShelfSpans(ctx: DeriveContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const max = ctx.material('shelves').maxShelfSpanMm;
  if (max === null) return issues;
  ctx.doc.layout.columns.forEach((column, ci) => {
    const span = ctx.layout.columns[ci]?.widthMm ?? 0;
    if (span <= max + EPS) return;
    column.sections.forEach((section, si) => {
      const kinds: string[] = [];
      if (si < column.sections.length - 1) kinds.push('fixed');
      if (section.interior.kind === 'adjustableShelves') kinds.push('adjustable');
      for (const shelf of kinds) {
        issues.push(
          issue('SHELF_SPAN_HEURISTIC', { kind: 'section', id: section.id, field: shelf }, { spanMm: span, maxMm: max }),
        );
      }
    });
  });
  return issues;
}

/** Checks on the derived carcass (plan T-004 list). */
export function checkModel(ctx: DeriveContext, parts: readonly Part[]): ValidationIssue[] {
  const issues = [...checkSheets(ctx, parts), ...checkShelfSpans(ctx)];
  if (parts.length > LIMITS.maxDerivedParts) {
    issues.push(
      issue('TOO_MANY_PARTS', { kind: 'design', id: ctx.doc.id }, { count: parts.length, maxCount: LIMITS.maxDerivedParts }),
    );
  }
  return issues;
}
