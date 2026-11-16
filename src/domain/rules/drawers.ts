import type { Part, Vec3 } from '../derive/model';
import type { DrawerLayout } from '../derive/drawers';
import { emptyOutput, screwItem, screwPositions, toLocal, type RuleContext, type RuleOutput, type ScrewKey } from './common';

// Plan F.7: slide hole offsets are only used up to the slide length minus 20 mm.
const SLIDE_OFFSET_LIMIT_MM = 20;

function addLineJoint(
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
      purpose: screw === 'drawerBoxScrew' ? 'drawer-box-screw' : 'drawer-bottom-screw',
      profileKey: null,
      jointId,
    });
  }
  out.joints.push({ id: jointId, kind: 'screw-butt', facePartId: face.id, otherPartId: other.id, screw, count: points.length });
  out.hardware.push(screwItem(ctx.doc.hardware, screw, points.length, [face.id, other.id]));
}

/** Plan §4.7.1 drawer rows: sides into the inner front/back, bottom from below into all four. */
function drawerJoints(ctx: RuleContext, out: RuleOutput, d: DrawerLayout): void {
  const b = d.box;
  if (!b) return;
  const get = (name: string) => ctx.parts.get(`drw:${d.drawerId}:${name}`);
  const sideL = get('sideL');
  const sideR = get('sideR');
  const inFront = get('inFront');
  const inBack = get('inBack');
  const bottom = get('bottom');
  if (!sideL || !sideR || !inFront || !inBack || !bottom) return;
  const c = ctx.doc.construction;
  const { tb, tbt } = ctx.dims;
  const D = b.zFront;
  const z0 = D - b.Ls;
  const pos = (length: number) => screwPositions(length, c.screwEdgeDistanceMm, c.screwMaxSpacingMm);
  const sideHeights = pos(b.hBox - tbt).map((p) => b.yBox + tbt + p);
  const yBottom = b.yBox + tbt / 2;

  for (const [side, sink, x] of [
    [sideL, 'B', b.x0 + tb / 2],
    [sideR, 'A', b.x1 - tb / 2],
  ] as const) {
    addLineJoint(ctx, out, side, inFront, 'drawerBoxScrew', sink, sideHeights.map((y): Vec3 => [x, y, D - tb / 2]));
    addLineJoint(ctx, out, side, inBack, 'drawerBoxScrew', sink, sideHeights.map((y): Vec3 => [x, y, z0 + tb / 2]));
    addLineJoint(ctx, out, bottom, side, 'drawerBottomScrew', 'B', pos(b.Ls).map((p): Vec3 => [x, yBottom, z0 + p]));
  }
  const inner = pos(b.x1 - b.x0 - 2 * tb).map((p) => b.x0 + tb + p);
  addLineJoint(ctx, out, bottom, inFront, 'drawerBottomScrew', 'B', inner.map((x): Vec3 => [x, yBottom, D - tb / 2]));
  addLineJoint(ctx, out, bottom, inBack, 'drawerBottomScrew', 'B', inner.map((x): Vec3 => [x, yBottom, z0 + tb / 2]));
}

/** Plan §4.7.5: cabinet members on both boundary faces, drawer members on the box sides' outer faces. */
function slides(ctx: RuleContext, out: RuleOutput, d: DrawerLayout): void {
  const b = d.box;
  if (!b) return;
  const sl = ctx.doc.hardware.slide;
  const { tbt } = ctx.dims;
  const D = b.zFront;
  const columns = ctx.layout.columns;
  const rc = columns[d.columnIndex];
  const left = ctx.parts.get(d.columnIndex === 0 ? 'side:L' : `divider:${columns[d.columnIndex - 1]?.id ?? ''}`);
  const right = ctx.parts.get(d.columnIndex === columns.length - 1 ? 'side:R' : `divider:${rc?.id ?? ''}`);
  const sideL = ctx.parts.get(`drw:${d.drawerId}:sideL`);
  const sideR = ctx.parts.get(`drw:${d.drawerId}:sideR`);
  if (!left || !right || !sideL || !sideR) return;

  const ySlide = b.yBox + tbt + (b.hBox - tbt) / 2 + d.slideOffsetMm;
  const limit = b.Ls - SLIDE_OFFSET_LIMIT_MM;
  const hole = (partId: string, face: 'A' | 'B', uv: { uMm: number; vMm: number }, purpose: 'slide-cabinet' | 'slide-drawer') =>
    out.holes.push({
      partId,
      face,
      ...uv,
      diameterMm: sl.holeDiameterMm,
      depthMm: sl.holeDepthMm,
      countersinkDiameterMm: null,
      purpose,
      profileKey: 'slide',
      jointId: null,
    });

  let count = 0;
  for (const offset of sl.cabinetHoleOffsetsMm.filter((o) => o <= limit + 1e-6)) {
    const point: Vec3 = [0, ySlide, D - sl.frontSetbackMm - offset];
    hole(left.id, 'A', toLocal(left, point), 'slide-cabinet');
    hole(right.id, 'B', toLocal(right, point), 'slide-cabinet');
    count += 2;
  }
  for (const offset of sl.drawerHoleOffsetsMm.filter((o) => o <= limit + 1e-6)) {
    const uv = { uMm: b.Ls - sl.frontSetbackMm - offset, vMm: (b.hBox - tbt) / 2 + d.slideOffsetMm };
    hole(sideL.id, 'B', uv, 'slide-drawer');
    hole(sideR.id, 'A', uv, 'slide-drawer');
    count += 2;
  }

  const partIds = [left.id, right.id, sideL.id, sideR.id];
  out.hardware.push(
    {
      key: `slide:${String(b.Ls)}`,
      kind: 'slide',
      labelParams: { name: sl.name, lengthMm: b.Ls },
      quantity: 1,
      unit: 'pairs',
      profileKey: 'slide',
      partIds,
    },
    { key: 'slide-screw', kind: 'screw', labelParams: { label: sl.screwLabel }, quantity: count, unit: 'pcs', profileKey: null, partIds },
  );
}

export function deriveDrawerRules(ctx: RuleContext): RuleOutput {
  const out = emptyOutput();
  for (const d of ctx.drawers) {
    drawerJoints(ctx, out, d);
    slides(ctx, out, d);
  }
  return out;
}
