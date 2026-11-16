import { LIMITS } from '../document/limits';
import type { Interior, SizeSpec } from '../document/types';
import { coveringSection } from '../layout/frontGrid';
import { apply, findColumn, findSection, type Operation } from './result';

const AUTO: SizeSpec = { mode: 'auto' };

/** Inserts a new auto column with one empty section before `atIndex` (0 … column count). */
export const addColumn: Operation<{ atIndex: number; columnId: string; sectionId: string }> = (doc, args) =>
  apply(doc, (d) => {
    const columns = d.layout.columns;
    if (columns.length >= LIMITS.columns.max) return 'max-columns';
    if (!Number.isInteger(args.atIndex) || args.atIndex < 0 || args.atIndex > columns.length) return 'out-of-range';
    columns.splice(args.atIndex, 0, {
      id: args.columnId,
      width: AUTO,
      sections: [{ id: args.sectionId, height: AUTO, interior: { kind: 'empty' }, front: { kind: 'none' } }],
    });
  });

export const removeColumn: Operation<{ columnId: string }> = (doc, { columnId }) =>
  apply(doc, (d) => {
    const index = d.layout.columns.findIndex((c) => c.id === columnId);
    if (index < 0) return 'not-found';
    if (d.layout.columns.length <= 1) return 'last-column';
    d.layout.columns.splice(index, 1);
  });

export const setColumnWidth: Operation<{ columnId: string; width: SizeSpec }> = (doc, { columnId, width }) =>
  apply(doc, (d) => {
    const column = findColumn(d, columnId);
    if (!column) return 'not-found';
    column.width = structuredClone(width);
  });

/**
 * Inserts a fixed shelf: the section keeps its contents, a new empty auto section is added above it.
 * A door covering the section grows by one section, so it still closes the same opening.
 */
export const splitSection: Operation<{ sectionId: string; newSectionId: string }> = (doc, { sectionId, newSectionId }) =>
  apply(doc, (d) => {
    const ref = findSection(d, sectionId);
    if (!ref) return 'not-found';
    if (ref.column.sections.length >= LIMITS.sectionsPerColumn.max) return 'max-sections';
    const owner = coveringSection(ref.column.sections, ref.sectionIndex);
    const front = owner === null ? undefined : ref.column.sections[owner]?.front;
    if (front && (front.kind === 'door' || front.kind === 'doubleDoor')) front.spanSections = (front.spanSections ?? 1) + 1;
    ref.column.sections.splice(ref.sectionIndex + 1, 0, {
      id: newSectionId,
      height: AUTO,
      interior: { kind: 'empty' },
      front: { kind: 'none' },
    });
  });

/**
 * Removes the fixed shelf above the section and the section above it; the lower section keeps its
 * contents. Two fixed heights merge into one fixed height including the removed shelf.
 */
export const mergeSectionWithAbove: Operation<{ sectionId: string }> = (doc, { sectionId }) =>
  apply(doc, (d) => {
    const ref = findSection(d, sectionId);
    if (!ref) return 'not-found';
    const above = ref.column.sections[ref.sectionIndex + 1];
    if (!above) return 'no-section-above';
    const lower = ref.section.height;
    const upper = above.height;
    if (lower.mode === 'fixed' && upper.mode === 'fixed') {
      const shelf = d.materials.find((m) => m.id === d.carcass.materialIds.shelves)?.thicknessMm ?? 0;
      ref.section.height = { mode: 'fixed', valueMm: lower.valueMm + upper.valueMm + shelf };
    } else {
      ref.section.height = AUTO;
    }
    // A door spanning up from below loses the removed section.
    const owner = coveringSection(ref.column.sections, ref.sectionIndex + 1);
    const front = owner !== null && owner <= ref.sectionIndex ? ref.column.sections[owner]?.front : undefined;
    if (front && (front.kind === 'door' || front.kind === 'doubleDoor') && front.spanSections !== undefined) {
      if (front.spanSections <= 2) delete front.spanSections;
      else front.spanSections -= 1;
    }
    ref.column.sections.splice(ref.sectionIndex + 1, 1);
  });

export const setSectionHeight: Operation<{ sectionId: string; height: SizeSpec }> = (doc, { sectionId, height }) =>
  apply(doc, (d) => {
    const ref = findSection(d, sectionId);
    if (!ref) return 'not-found';
    ref.section.height = structuredClone(height);
  });

export const setInterior: Operation<{ sectionId: string; interior: Interior }> = (doc, { sectionId, interior }) =>
  apply(doc, (d) => {
    const ref = findSection(d, sectionId);
    if (!ref) return 'not-found';
    if (ref.section.front.kind === 'drawers' && interior.kind !== 'empty') return 'drawers-present';
    ref.section.interior = structuredClone(interior);
  });
