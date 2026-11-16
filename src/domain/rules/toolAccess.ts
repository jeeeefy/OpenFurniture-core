import { issue, type ValidationIssue } from '../validate/catalogue';
import type { RuleContext } from './common';
import { bracketedShelfSections } from './screwJoinery';

const NARROW_COLUMN_MM = 150;

/**
 * Plan §4.7.11 P2: column c's fixed shelves are screwed through divider c−1 from its left face, so the
 * driver works inside column c−1's section around each screw height.
 */
export function checkToolAccess(ctx: RuleContext): ValidationIssue[] {
  const c = ctx.doc.construction;
  const columns = ctx.layout.columns;
  const flagged = new Map<string, ValidationIssue>();
  const bracketed = bracketedShelfSections(ctx);
  for (let ci = 1; ci < columns.length; ci += 1) {
    const column = columns[ci];
    const leftColumn = columns[ci - 1];
    if (!column || !leftColumn) continue;
    for (const shelfSection of column.sections.slice(0, -1)) {
      if (bracketed.has(shelfSection.id)) continue;
      const y = shelfSection.y1 + ctx.dims.tF / 2;
      const space = leftColumn.sections.find((s) => y >= s.y0 && y <= s.y1);
      if (!space || flagged.has(space.id)) continue;
      const clearance = Math.min(y - space.y0, space.y1 - y);
      if (clearance < c.toolClearanceMm || space.heightMm < c.toolBodyClearanceMm) {
        flagged.set(
          space.id,
          issue('TOOL_ACCESS_TIGHT', { kind: 'section', id: space.id, field: 'height' }, {
            screwYMm: Math.round(y * 10) / 10,
            clearanceMm: Math.round(clearance * 10) / 10,
            heightMm: space.heightMm,
          }),
        );
      }
    }
  }
  return [...flagged.values()];
}

/** Column narrower than 150 mm with drawers or a rail: hard to mount slides or supports. */
export function checkNarrowCompartments(ctx: RuleContext): ValidationIssue[] {
  return ctx.doc.layout.columns.flatMap((column, ci) => {
    const width = ctx.layout.columns[ci]?.widthMm ?? 0;
    const needsAccess = column.sections.some(
      (s) => s.front.kind === 'drawers' || s.interior.kind === 'clothesRail' || s.interior.kind === 'innerDrawers',
    );
    return width < NARROW_COLUMN_MM && needsAccess
      ? [issue('NARROW_COMPARTMENT_TOOL_ACCESS', { kind: 'column', id: column.id, field: 'width' }, { widthMm: width, minMm: NARROW_COLUMN_MM })]
      : [];
  });
}

/** One warning per used hinge, slide, handle or rail profile that is not verified (AC-023). */
export function checkUnverifiedProfiles(ctx: RuleContext): ValidationIssue[] {
  const hw = ctx.doc.hardware;
  const sections = ctx.doc.layout.columns.flatMap((c) => c.sections);
  const used: { id: string; name: string; verified: boolean; key: string }[] = [];
  if (sections.some((s) => s.front.kind === 'door' || s.front.kind === 'doubleDoor')) {
    used.push({ id: hw.hinge.id, name: hw.hinge.name, verified: hw.hinge.verifiedByUser, key: 'hinge' });
  }
  if (sections.some((s) => s.front.kind === 'drawers' || s.interior.kind === 'innerDrawers')) {
    used.push({ id: hw.slide.id, name: hw.slide.name, verified: hw.slide.verifiedByUser, key: 'slide' });
  }
  for (const handle of hw.handles) {
    if (sections.some((s) => s.front.kind !== 'none' && s.front.handleId === handle.id)) {
      used.push({ id: handle.id, name: handle.name, verified: handle.verifiedByUser, key: `handle:${handle.id}` });
    }
  }
  if (sections.some((s) => s.interior.kind === 'clothesRail')) {
    used.push({ id: hw.clothesRail.id, name: hw.clothesRail.name, verified: hw.clothesRail.verifiedByUser, key: 'clothesRail' });
  }
  return used
    .filter((p) => !p.verified)
    .map((p) => issue('HARDWARE_PROFILE_UNVERIFIED', { kind: 'profile', id: p.id, field: 'verifiedByUser' }, { profile: p.key, name: p.name }));
}
