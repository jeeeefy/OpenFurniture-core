import { LIMITS } from '../document/limits';
import type { DesignDocument, Front, SizeSpec } from '../document/types';
import { apply, findSection, type Operation } from './result';

const handleExists = (doc: DesignDocument, handleId: string | null) =>
  handleId === null || doc.hardware.handles.some((h) => h.id === handleId);

/** New drawer ids come in with `front.drawers`; `clearInterior` empties the section for drawers. */
export const setFront: Operation<{ sectionId: string; front: Front; clearInterior: boolean }> = (doc, args) =>
  apply(doc, (d) => {
    const ref = findSection(d, args.sectionId);
    if (!ref) return 'not-found';
    const front = args.front;
    if (front.kind !== 'none' && !handleExists(d, front.handleId)) return 'unknown-handle';
    if (front.kind === 'drawers') {
      if (front.drawers.length > LIMITS.drawersPerSection.max) return 'max-drawers';
      if (ref.section.interior.kind !== 'empty') {
        if (!args.clearInterior) return 'interior-not-empty';
        ref.section.interior = { kind: 'empty' };
      }
    }
    ref.section.front = structuredClone(front);
  });

/** A door covering `span` sections from this one upwards, across the fixed shelves between them. */
export const setFrontSpan: Operation<{ sectionId: string; span: number }> = (doc, { sectionId, span }) =>
  apply(doc, (d) => {
    const ref = findSection(d, sectionId);
    const front = ref?.section.front;
    if (!ref || !front || (front.kind !== 'door' && front.kind !== 'doubleDoor')) return 'not-found';
    if (!Number.isInteger(span) || span < 1 || span > ref.column.sections.length - ref.sectionIndex) return 'out-of-range';
    const covered = ref.column.sections.slice(ref.sectionIndex + 1, ref.sectionIndex + span);
    if (covered.some((s) => s.front.kind !== 'none')) return 'front-overlap';
    if (span === 1) delete front.spanSections;
    else front.spanSections = span;
  });

export const setDrawerFrontHeight: Operation<{ drawerId: string; frontHeight: SizeSpec }> = (doc, args) =>
  apply(doc, (d) => {
    for (const column of d.layout.columns) {
      for (const section of column.sections) {
        if (section.front.kind !== 'drawers') continue;
        const drawer = section.front.drawers.find((dr) => dr.id === args.drawerId);
        if (drawer) {
          drawer.frontHeight = structuredClone(args.frontHeight);
          return;
        }
      }
    }
    return 'not-found';
  });

export const setHandle: Operation<{ sectionId: string; handleId: string | null }> = (doc, { sectionId, handleId }) =>
  apply(doc, (d) => {
    const ref = findSection(d, sectionId);
    if (!ref || ref.section.front.kind === 'none') return 'not-found';
    if (!handleExists(d, handleId)) return 'unknown-handle';
    ref.section.front.handleId = handleId;
  });
