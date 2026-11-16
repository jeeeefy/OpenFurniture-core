import type { Part, Vec3 } from '../derive/model';
import { ceilSafe } from '../units';
import { issue } from '../validate/catalogue';
import {
  emptyOutput,
  fastenerPositions,
  screwItem,
  screwPositions,
  toLocal,
  type RuleContext,
  type RuleOutput,
  type ScrewKey,
} from './common';

/** Glue + countersunk screws through the face part into the edge of the other part (plan §4.7.1). */
function addButtJoint(
  ctx: RuleContext,
  out: RuleOutput,
  face: Part,
  other: Part,
  screw: ScrewKey,
  countersinkFace: 'A' | 'B',
  points: Vec3[],
): void {
  const spec = ctx.doc.hardware[screw];
  const jointId = `joint:${face.id}:${other.id}`;
  for (const point of points) {
    out.holes.push({
      partId: face.id,
      face: countersinkFace,
      ...toLocal(face, point),
      diameterMm: spec.clearanceHoleMm,
      depthMm: 'through',
      countersinkDiameterMm: spec.countersinkDiameterMm,
      purpose: screw === 'plinthScrew' ? 'plinth-screw' : 'carcass-screw',
      profileKey: null,
      jointId,
    });
  }
  out.joints.push({ id: jointId, kind: 'screw-butt', facePartId: face.id, otherPartId: other.id, screw, count: points.length });
  out.hardware.push(screwItem(ctx.doc.hardware, screw, points.length, [face.id, other.id]));
}

/** TYPICAL: bracket positions start this far from the front and back edges. */
const BRACKET_END_OFFSET_MM = 50;
/** Mark height of the bracket's vertical leg below the shelf (half of a 40 mm leg). */
const BRACKET_MARK_BELOW_MM = 20;

/**
 * Fixed shelves whose centre is closer than `minFixedShelfOffsetAcrossDividerMm` to a fixed shelf in the column
 * to the left. Their screws through the divider would have to be driven where the left shelf already sits,
 * so they hang on angle brackets underneath instead (screwed from inside their own column).
 */
export function bracketedShelfSections(ctx: RuleContext): Set<string> {
  const minOffset = ctx.doc.construction.minFixedShelfOffsetAcrossDividerMm;
  const tF = ctx.dims.tF;
  const centres = (ci: number) =>
    (ctx.layout.columns[ci]?.sections.slice(0, -1) ?? []).map((s) => ({ id: s.id, y: s.y1 + tF / 2 }));
  const result = new Set<string>();
  for (let ci = 1; ci < ctx.layout.columns.length; ci += 1) {
    const left = centres(ci - 1);
    for (const shelf of centres(ci)) {
      if (left.some((l) => Math.abs(l.y - shelf.y) < minOffset - 1e-6)) result.add(shelf.id);
    }
  }
  return result;
}

function addShelfBrackets(ctx: RuleContext, out: RuleOutput, divider: Part, shelf: Part, shelfBottomY: number): void {
  const pb = ctx.doc.hardware.plinthBracket;
  const { Dc, tB, t, tF } = ctx.dims;
  const c = ctx.doc.construction;
  const positions = fastenerPositions(Dc, BRACKET_END_OFFSET_MM, pb.maxSpacingMm);
  for (const p of positions) {
    const point: Vec3 = [0, shelfBottomY - BRACKET_MARK_BELOW_MM, tB + p];
    out.marks.push({ partId: divider.id, face: 'A', ...toLocal(divider, point), purpose: 'shelf-bracket' });
  }
  const partIds = [divider.id, shelf.id];
  out.hardware.push(
    { key: 'plinth-bracket', kind: 'plinth-bracket', labelParams: { label: pb.label }, quantity: positions.length, unit: 'pcs', profileKey: null, partIds },
    {
      key: 'screw:plinthBracket',
      kind: 'screw',
      labelParams: { label: pb.screwLabel },
      quantity: positions.length * pb.screwsPerBracket,
      unit: 'pcs',
      profileKey: null,
      partIds,
    },
  );
  // The plinth check already covers the carcass thickness; shelves may be thinner.
  const maxLength = Math.min(t, tF) - c.minRemainingMaterialMm + 2;
  const plinthChecked = ctx.doc.carcass.base.kind === 'plinth' && tF >= t;
  const reported = out.issues.some((i) => i.code === 'SCREW_TOO_LONG' && i.target.id === 'plinthBracket');
  if (pb.screwLengthMm > maxLength && !plinthChecked && !reported) {
    out.issues.push(
      issue('SCREW_TOO_LONG', { kind: 'profile', id: 'plinthBracket', field: 'screwLengthMm' }, { lengthMm: pb.screwLengthMm, maxMm: maxLength }),
    );
  }
}

export function deriveScrewJoints(ctx: RuleContext): RuleOutput {
  const out = emptyOutput();
  const { W, H, D, hP, t, tB, tF, tP, Dc } = ctx.dims;
  const c = ctx.doc.construction;
  const get = (id: string) => ctx.parts.get(id);
  const along = screwPositions(Dc, c.screwEdgeDistanceMm, c.screwMaxSpacingMm);
  const depthLine = (x: number, y: number): Vec3[] => along.map((p) => [x, y, tB + p]);

  const sideL = get('side:L');
  const sideR = get('side:R');
  const top = get('top');
  const bottom = get('bottom');
  if (!sideL || !sideR || !top || !bottom) return out;

  for (const [side, x, sink] of [
    [sideL, t / 2, 'B'],
    [sideR, W - t / 2, 'A'],
  ] as const) {
    addButtJoint(ctx, out, side, top, 'carcassScrew', sink, depthLine(x, H - t / 2));
    addButtJoint(ctx, out, side, bottom, 'carcassScrew', sink, depthLine(x, hP + t / 2));
  }

  const columns = ctx.layout.columns;
  for (const column of columns.slice(0, -1)) {
    const divider = get(`divider:${column.id}`);
    if (!divider) continue;
    const x = column.x1 + t / 2;
    // Bottom screws are countersunk on the underside, driven in P3 before the plinth exists.
    addButtJoint(ctx, out, top, divider, 'carcassScrew', 'A', depthLine(x, H - t / 2));
    addButtJoint(ctx, out, bottom, divider, 'carcassScrew', 'B', depthLine(x, hP + t / 2));
  }

  columns.forEach((column, ci) => {
    const left = ci === 0 ? sideL : get(`divider:${columns[ci - 1]?.id ?? ''}`);
    const right = ci === columns.length - 1 ? sideR : get(`divider:${column.id}`);
    const bracketed = bracketedShelfSections(ctx);
    for (const section of column.sections.slice(0, -1)) {
      const shelf = get(`fixed:${section.id}`);
      if (!shelf || !left || !right) continue;
      const y = section.y1 + tF / 2;
      // Countersinks sit on the face away from the shelf.
      if (bracketed.has(section.id)) addShelfBrackets(ctx, out, left, shelf, section.y1);
      else addButtJoint(ctx, out, left, shelf, 'carcassScrew', 'B', depthLine(left.box.min[0], y));
      addButtJoint(ctx, out, right, shelf, 'carcassScrew', 'A', depthLine(right.box.max[0], y));
    }
  });

  const base = ctx.doc.carcass.base;
  const plinthL = get('plinth:L');
  const plinthR = get('plinth:R');
  const plinthF = get('plinth:F');
  const plinthB = get('plinth:B');
  if (base.kind === 'plinth' && plinthL && plinthR && plinthF && plinthB) {
    const heights = screwPositions(hP, c.screwEdgeDistanceMm, c.screwMaxSpacingMm);
    const zFront = D - base.setbackFrontMm - tP / 2;
    const zBack = base.setbackBackMm + tP / 2;
    for (const [side, sink] of [
      [plinthL, 'B'],
      [plinthR, 'A'],
    ] as const) {
      const x = (side.box.min[0] + side.box.max[0]) / 2;
      addButtJoint(ctx, out, side, plinthF, 'plinthScrew', sink, heights.map((y): Vec3 => [x, y, zFront]));
      addButtJoint(ctx, out, side, plinthB, 'plinthScrew', sink, heights.map((y): Vec3 => [x, y, zBack]));
    }
  }
  return out;
}

/** Steel angle brackets on the rails' inner faces, screwed into the rails and the bottom panel (plan §4.7.1). */
export function derivePlinthBrackets(ctx: RuleContext): RuleOutput {
  const out = emptyOutput();
  const pb = ctx.doc.hardware.plinthBracket;
  const rails = ['plinth:L', 'plinth:R', 'plinth:F', 'plinth:B'].map((id) => ctx.parts.get(id));
  if (ctx.doc.carcass.base.kind !== 'plinth' || rails.some((r) => !r)) return out;

  let brackets = 0;
  for (const rail of rails) {
    if (rail) brackets += Math.max(2, ceilSafe(rail.lengthMm / pb.maxSpacingMm));
  }
  const railIds = rails.flatMap((r) => (r ? [r.id] : []));
  out.hardware.push(
    {
      key: 'plinth-bracket',
      kind: 'plinth-bracket',
      labelParams: { label: pb.label },
      quantity: brackets,
      unit: 'pcs',
      profileKey: null,
      partIds: railIds,
    },
    {
      key: 'screw:plinthBracket',
      kind: 'screw',
      labelParams: { label: pb.screwLabel },
      quantity: brackets * pb.screwsPerBracket,
      unit: 'pcs',
      profileKey: null,
      partIds: [...railIds, 'bottom'],
    },
  );

  // A 2 mm bracket leg (TYPICAL) adds to the depth available in the bottom panel.
  const maxLength = ctx.dims.t - ctx.doc.construction.minRemainingMaterialMm + 2;
  if (pb.screwLengthMm > maxLength) {
    out.issues.push(
      issue('SCREW_TOO_LONG', { kind: 'profile', id: 'plinthBracket', field: 'screwLengthMm' }, {
        lengthMm: pb.screwLengthMm,
        maxMm: maxLength,
      }),
    );
  }
  return out;
}
