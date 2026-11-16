import { doorLeaves } from '../derive/doors';
import type { HandleProfile } from '../document/types';
import type { Part } from '../derive/model';
import { issue } from '../validate/catalogue';
import { emptyOutput, screwItem, type RuleContext, type RuleOutput } from './common';

// Plan F.7 fixed rules (‡): door handle inset from the opening edge and height rule.
const DOOR_HANDLE_INSET_MM = 40;
const HANDLE_HEIGHT_MM = 1000;
const HANDLE_END_OFFSET_MM = 80;
// Drawer-front attachment pattern (‡).
const ATTACH_WIDE_FRONT_MM = 300;
const ATTACH_EDGE_OFFSET_MM = 60;

/** Door handle centre height: top ≤ 1000 → top − 80; bottom ≥ 1000 → bottom + 80; else 1000. */
export function doorHandleY(yB: number, yT: number): number {
  if (yT <= HANDLE_HEIGHT_MM) return yT - HANDLE_END_OFFSET_MM;
  if (yB >= HANDLE_HEIGHT_MM) return yB + HANDLE_END_OFFSET_MM;
  return HANDLE_HEIGHT_MM;
}

function handleOffsets(handle: HandleProfile): number[] {
  return handle.kind === 'bar' && handle.centerDistanceMm !== null
    ? [-handle.centerDistanceMm / 2, handle.centerDistanceMm / 2]
    : [0];
}

function addHandle(
  ctx: RuleContext,
  out: RuleOutput,
  handle: HandleProfile,
  front: Part,
  holes: { uMm: number; vMm: number }[],
  throughMm: number,
  target: { kind: 'section' | 'drawer'; id: string },
): void {
  const c = ctx.doc.construction;
  const r = handle.holeDiameterMm / 2;
  for (const h of holes) {
    out.holes.push({
      partId: front.id,
      face: 'A',
      ...h,
      diameterMm: handle.holeDiameterMm,
      depthMm: 'through',
      countersinkDiameterMm: null,
      purpose: 'handle',
      profileKey: 'handle',
      jointId: null,
    });
  }
  const tooClose = holes.some(
    (h) => Math.min(h.uMm, front.lengthMm - h.uMm, h.vMm, front.widthMm - h.vMm) - r < c.minHoleEdgeMaterialMm - 1e-6,
  );
  if (tooClose) out.issues.push(issue('HANDLE_DOES_NOT_FIT', { ...target, field: 'front' }, { handle: handle.name }));

  const required = throughMm + handle.screwEngagementMm;
  const length = handle.screwLengthsMm.find((l) => l >= required - 1e-6);
  if (length === undefined) {
    out.issues.push(
      issue('HANDLE_SCREW_LENGTH_UNAVAILABLE', { kind: 'profile', id: handle.id, field: 'screwLengthsMm' }, {
        requiredMm: required,
        handle: handle.name,
      }),
    );
  }
  const screwLength = length ?? Math.ceil(required);
  out.hardware.push(
    {
      key: `handle:${handle.id}`,
      kind: 'handle',
      labelParams: { name: handle.name },
      quantity: 1,
      unit: 'pcs',
      profileKey: `handle:${handle.id}`,
      partIds: [front.id],
    },
    {
      key: `handle-screw:${String(screwLength)}`,
      kind: 'screw',
      labelParams: { label: `M4 × ${String(screwLength)}` },
      quantity: holes.length,
      unit: 'pcs',
      profileKey: null,
      partIds: [front.id],
    },
  );
}

/** Plan §4.7.6: door handles vertical near the opening edge, drawer handles horizontal and centred. */
export function deriveHandles(ctx: RuleContext): RuleOutput {
  const out = emptyOutput();
  const { tFr, tb } = ctx.dims;
  const handles = new Map(ctx.doc.hardware.handles.map((h) => [h.id, h]));
  const sections = new Map(ctx.doc.layout.columns.flatMap((c) => c.sections).map((s) => [s.id, s]));

  for (const leaf of doorLeaves(ctx)) {
    const front = sections.get(leaf.sectionId)?.front;
    const handle = front && front.kind !== 'none' && front.handleId ? handles.get(front.handleId) : undefined;
    const door = ctx.parts.get(leaf.id);
    if (!handle || !door) continue;
    const x = leaf.hinge === 'left' ? leaf.xR - DOOR_HANDLE_INSET_MM : leaf.xL + DOOR_HANDLE_INSET_MM;
    const y = doorHandleY(leaf.yB, leaf.yT);
    // Door frame: u along y from the bottom edge, v along x from the left edge.
    const holes = handleOffsets(handle).map((o) => ({ uMm: y + o - leaf.yB, vMm: x - leaf.xL }));
    addHandle(ctx, out, handle, door, holes, tFr, { kind: 'section', id: leaf.sectionId });
  }

  for (const d of ctx.drawers) {
    const front = sections.get(d.sectionId)?.front;
    const handle = front?.kind === 'drawers' && front.handleId ? handles.get(front.handleId) : undefined;
    const part = ctx.parts.get(`drw:${d.drawerId}:front`);
    if (!handle || !part) continue;
    // Drawer-front frame: u along x, v along y; the handle is centred.
    const holes = handleOffsets(handle).map((o) => ({ uMm: part.lengthMm / 2 + o, vMm: part.widthMm / 2 }));
    addHandle(ctx, out, handle, part, holes, tFr + tb, { kind: 'drawer', id: d.drawerId });
  }
  return out;
}

/** Plan §4.7.1 `screw-face`: the drawer front is screwed on from inside the box through the inner front. */
export function deriveFrontAttachment(ctx: RuleContext): RuleOutput {
  const out = emptyOutput();
  const c = ctx.doc.construction;
  const spec = ctx.doc.hardware.frontScrew;
  const { tFr, tb } = ctx.dims;
  if (ctx.drawers.some((d) => !d.inner) && spec.lengthMm > tb + tFr - c.minRemainingMaterialMm + 1e-6) {
    out.issues.push(
      issue('SCREW_TOO_LONG', { kind: 'profile', id: 'frontScrew', field: 'lengthMm' }, {
        lengthMm: spec.lengthMm,
        maxMm: tb + tFr - c.minRemainingMaterialMm,
      }),
    );
  }
  for (const d of ctx.drawers) {
    const inner = ctx.parts.get(`drw:${d.drawerId}:inFront`);
    const front = ctx.parts.get(`drw:${d.drawerId}:front`);
    if (!inner || !front) continue;
    const len = inner.lengthMm;
    const h = inner.widthMm;
    const us = [ATTACH_EDGE_OFFSET_MM, len - ATTACH_EDGE_OFFSET_MM];
    const vs = front.lengthMm >= ATTACH_WIDE_FRONT_MM ? [h / 3, (2 * h) / 3] : [h / 2];
    const jointId = `joint:${inner.id}:${front.id}`;
    let count = 0;
    for (const uMm of us) {
      for (const vMm of vs) {
        out.holes.push({
          partId: inner.id,
          face: 'B',
          uMm,
          vMm,
          diameterMm: spec.clearanceHoleMm,
          depthMm: 'through',
          countersinkDiameterMm: spec.countersinkDiameterMm,
          purpose: 'front-attach',
          profileKey: null,
          jointId,
        });
        count += 1;
      }
    }
    out.joints.push({ id: jointId, kind: 'screw-face', facePartId: inner.id, otherPartId: front.id, screw: 'frontScrew', count });
    out.hardware.push(screwItem(ctx.doc.hardware, 'frontScrew', count, [inner.id, front.id]));
  }
  return out;
}
