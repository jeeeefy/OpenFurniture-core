import { distribute } from '../layout/distribute';
import { behindDoor, frontZone } from '../layout/frontGrid';
import { floorSafe } from '../units';
import { issue, type ValidationIssue } from '../validate/catalogue';
import { holesConflict } from '../validate/holeChecks';
import type { DeriveContext } from './context';
import { makeBox, makePart } from './frames';
import type { Part, ResolvedColumn, ResolvedSection } from './model';

const MIN_INNER_BOX_WIDTH_MM = 50;
/** TYPICAL: inner drawers behind a door start behind the hinge plates and arms (plate hole line 37 mm + plate and arm). */
export const INNER_DRAWER_DOOR_SETBACK_MM = 70;
/** L-18: smallest slide offset that clears the 2.5 mm holes on opposite divider faces (3 mm hole spacing). */
const SLIDE_OFFSET_START_MM = 6;

export interface DrawerBox {
  /** Outer x range of the box (between the slides). */
  x0: number;
  x1: number;
  yBox: number;
  hBox: number;
  /** Slide length = box length. */
  Ls: number;
  /** Front face of the box (z); the box runs from zFront − Ls to zFront. */
  zFront: number;
}

export interface DrawerLayout {
  drawerId: string;
  sectionId: string;
  columnIndex: number;
  /** Inner drawers have no own front; their parts belong to the section. */
  inner: boolean;
  xL: number;
  xR: number;
  fb: number;
  ft: number;
  box: DrawerBox | null;
  /**
   * L-18: vertical shift of the slide pair. Drawers that meet on opposite faces of a divider at the
   * same height get different slide centres so their screw holes do not collide.
   */
  slideOffsetMm: number;
}

/** Plan §4.4/§4.5: front stack, slot boundaries, box heights and slide length per drawer. */
export function drawerLayouts(ctx: DeriveContext): { drawers: DrawerLayout[]; issues: ValidationIssue[] } {
  const drawers: DrawerLayout[] = [];
  const issues: ValidationIssue[] = [];
  const c = ctx.doc.construction;
  const sl = ctx.doc.hardware.slide;
  const { tb, tbt, Dc } = ctx.dims;
  const gap = c.frontGapMm;

  ctx.doc.layout.columns.forEach((column, ci) => {
    const rc = ctx.layout.columns[ci];
    column.sections.forEach((section, si) => {
      const front = section.front;
      const rs = rc?.sections[si];
      if (section.interior.kind === 'innerDrawers' && rc && rs) {
        innerDrawers(ctx, section.id, section.interior.count, behindDoor(column.sections, si), ci, rc, rs, drawers, issues);
        return;
      }
      if (front.kind !== 'drawers' || !rc || !rs) return;
      const zone = frontZone(ctx.doc, ctx.layout, ctx.dims, ci, si);
      if (!zone) return;
      const target = { kind: 'section' as const, id: section.id, field: 'front' };
      const n = front.drawers.length;
      const heights = distribute(zone.yT - zone.yB - (n - 1) * gap, front.drawers.map((d) => d.frontHeight), 0);
      if (!heights.ok) {
        issues.push(issue('DRAWER_FRONTS_DONT_FIT', target, { availableMm: zone.yT - zone.yB - (n - 1) * gap }));
        return;
      }

      const usable = Dc - sl.rearClearanceMm - sl.frontSetbackMm;
      const Ls = [...sl.lengthsMm].reverse().find((length) => length <= usable + 1e-6) ?? null;
      if (Ls === null) issues.push(issue('DRAWER_DEPTH_NO_SLIDE', target, { availableMm: usable, minMm: sl.lengthsMm[0] ?? 0 }));

      const wBox = rc.widthMm - 2 * sl.sideClearanceMm;
      const tooNarrow = wBox - 2 * tb < MIN_INNER_BOX_WIDTH_MM;
      if (tooNarrow) issues.push(issue('DRAWER_BOX_TOO_NARROW', target, { innerWidthMm: wBox - 2 * tb, minMm: MIN_INNER_BOX_WIDTH_MM }));

      const fronts: { fb: number; ft: number }[] = [];
      let y = zone.yB;
      for (const h of heights.sizes) {
        fronts.push({ fb: y, ft: y + h });
        y += h + gap;
      }

      front.drawers.forEach((drawer, i) => {
        const f = fronts[i];
        if (!f) return;
        const slotBottom = i === 0 ? rs.y0 : ((fronts[i - 1]?.ft ?? 0) + f.fb) / 2;
        const slotTop = i === n - 1 ? rs.y1 : (f.ft + (fronts[i + 1]?.fb ?? 0)) / 2;
        const hBox = floorSafe(slotTop - slotBottom - c.drawerBoxClearanceBelowMm - c.drawerBoxClearanceAboveMm);
        const tooLow = hBox < c.minDrawerBoxHeightMm || hBox - tbt < sl.heightMm;
        if (tooLow) {
          issues.push(
            issue('DRAWER_BOX_TOO_LOW', { kind: 'drawer', id: drawer.id, field: 'frontHeight' }, {
              heightMm: hBox,
              minMm: Math.max(c.minDrawerBoxHeightMm, sl.heightMm + tbt),
            }),
          );
        }
        const box =
          Ls === null || tooLow || tooNarrow
            ? null
            : {
                x0: rc.x0 + sl.sideClearanceMm,
                x1: rc.x1 - sl.sideClearanceMm,
                yBox: slotBottom + c.drawerBoxClearanceBelowMm,
                hBox,
                Ls,
                zFront: ctx.dims.D,
              };
        drawers.push({
          drawerId: drawer.id,
          sectionId: section.id,
          columnIndex: ci,
          inner: false,
          xL: zone.xL,
          xR: zone.xR,
          fb: f.fb,
          ft: f.ft,
          box,
          slideOffsetMm: 0,
        });
      });
    });
  });
  resolveSlideConflicts(drawers, ctx);
  return { drawers, issues };
}

/** Vertical centre of the slide holes, including any L-18 offset. */
function slideCenterY(drawer: DrawerLayout, tbt: number): number | null {
  const b = drawer.box;
  if (!b) return null;
  return b.yBox + tbt + (b.hBox - tbt) / 2 + drawer.slideOffsetMm;
}

/** Mirrors the validator's opposite/same-face rule for the two cabinet slide hole sets. */
function slideHolesConflict(a: DrawerLayout, b: DrawerLayout, ctx: DeriveContext): boolean {
  if (!a.box || !b.box) return false;
  const ay = slideCenterY(a, ctx.dims.tbt);
  const by = slideCenterY(b, ctx.dims.tbt);
  if (ay === null || by === null) return false;
  const sl = ctx.doc.hardware.slide;
  const geometry = { diameterMm: sl.holeDiameterMm, depthMm: sl.holeDepthMm, countersinkDiameterMm: null };
  return holesConflict(
    { ...geometry, face: 'A', uMm: 0, vMm: 0 },
    {
      ...geometry,
      face: a.columnIndex === b.columnIndex ? 'A' : 'B',
      uMm: by - ay,
      vMm: b.box.zFront - a.box.zFront,
    },
    ctx.dims.tb,
    ctx.doc.construction.minHoleSpacingMm,
    ctx.doc.construction.minRemainingMaterialMm,
  );
}

/** How far the slide can move without leaving the drawer-box side. */
function slideShiftLimit(drawer: DrawerLayout, ctx: DeriveContext): number {
  const b = drawer.box;
  if (!b) return 0;
  return Math.max(0, (b.hBox - ctx.dims.tbt - ctx.doc.hardware.slide.heightMm) / 2);
}

function shiftResolves(
  drawer: DrawerLayout,
  neighbours: readonly DrawerLayout[],
  shiftMm: number,
  ctx: DeriveContext,
): boolean {
  if (Math.abs(shiftMm) > slideShiftLimit(drawer, ctx) + 1e-9) return false;
  const moved = { ...drawer, slideOffsetMm: shiftMm };
  return neighbours.every((other) => !slideHolesConflict(moved, other, ctx));
}

/**
 * L-18: when drawers sit at the same height on both sides of a divider their cabinet slide holes
 * land on opposite faces at the same (y, z). Shift the right-hand drawer's slide pair first, and
 * only fall back to the left one when the right box is too shallow. The smallest offset that clears
 * every neighbour wins, so the slide stays as close to the box centre as possible.
 */
function resolveSlideConflicts(drawers: DrawerLayout[], ctx: DeriveContext): void {
  for (let i = 0; i < drawers.length; i += 1) {
    const a = drawers[i];
    if (!a?.box) continue;
    for (let j = i + 1; j < drawers.length; j += 1) {
      const b = drawers[j];
      if (!b?.box || Math.abs(a.columnIndex - b.columnIndex) !== 1) continue;
      if (!slideHolesConflict(a, b, ctx)) continue;

      const right = a.columnIndex > b.columnIndex ? a : b;
      const left = right === a ? b : a;
      const tryMover = (mover: DrawerLayout): boolean => {
        const neighbours = drawers.filter(
          (other) => other !== mover && other.box !== null && Math.abs(other.columnIndex - mover.columnIndex) <= 1,
        );
        const limit = slideShiftLimit(mover, ctx);
        for (let distance = SLIDE_OFFSET_START_MM; distance <= limit + 1e-9; distance += 1) {
          for (const sign of [1, -1] as const) {
            if (shiftResolves(mover, neighbours, sign * distance, ctx)) {
              mover.slideOffsetMm = sign * distance;
              return true;
            }
          }
        }
        return false;
      };

      if (!tryMover(right)) tryMover(left);
    }
  }
}

/** Drawers without own fronts, evenly stacked in the section's clear height; behind a door they start behind the hinges. */
function innerDrawers(
  ctx: DeriveContext,
  sectionId: string,
  count: number,
  behindDoor: boolean,
  ci: number,
  rc: ResolvedColumn,
  rs: ResolvedSection,
  drawers: DrawerLayout[],
  issues: ValidationIssue[],
): void {
  const c = ctx.doc.construction;
  const sl = ctx.doc.hardware.slide;
  const { D, tb, tbt, Dc } = ctx.dims;
  const target = { kind: 'section' as const, id: sectionId, field: 'interior' };
  const setback = behindDoor ? INNER_DRAWER_DOOR_SETBACK_MM : 0;

  const usable = Dc - sl.rearClearanceMm - sl.frontSetbackMm - setback;
  const Ls = [...sl.lengthsMm].reverse().find((length) => length <= usable + 1e-6) ?? null;
  if (Ls === null) issues.push(issue('DRAWER_DEPTH_NO_SLIDE', target, { availableMm: usable, minMm: sl.lengthsMm[0] ?? 0 }));
  const wBox = rc.widthMm - 2 * sl.sideClearanceMm;
  const tooNarrow = wBox - 2 * tb < MIN_INNER_BOX_WIDTH_MM;
  if (tooNarrow) issues.push(issue('DRAWER_BOX_TOO_NARROW', target, { innerWidthMm: wBox - 2 * tb, minMm: MIN_INNER_BOX_WIDTH_MM }));

  const slot = rs.heightMm / count;
  const hBox = floorSafe(slot - c.drawerBoxClearanceBelowMm - c.drawerBoxClearanceAboveMm);
  const tooLow = hBox < c.minDrawerBoxHeightMm || hBox - tbt < sl.heightMm;
  if (tooLow) {
    issues.push(issue('DRAWER_BOX_TOO_LOW', target, { heightMm: hBox, minMm: Math.max(c.minDrawerBoxHeightMm, sl.heightMm + tbt) }));
  }
  for (let i = 0; i < count; i += 1) {
    const slotBottom = rs.y0 + i * slot;
    const box =
      Ls === null || tooLow || tooNarrow
        ? null
        : {
            x0: rc.x0 + sl.sideClearanceMm,
            x1: rc.x1 - sl.sideClearanceMm,
            yBox: slotBottom + c.drawerBoxClearanceBelowMm,
            hBox,
            Ls,
            zFront: D - setback,
          };
    drawers.push({
      drawerId: `${sectionId}.inner${String(i + 1)}`,
      sectionId,
      columnIndex: ci,
      inner: true,
      xL: rc.x0,
      xR: rc.x1,
      fb: slotBottom,
      ft: slotBottom + slot,
      box,
      slideOffsetMm: 0,
    });
  }
}

export function deriveDrawers(ctx: DeriveContext, drawers: readonly DrawerLayout[]): Part[] {
  const { D, tFr, tb, tbt } = ctx.dims;
  const fronts = ctx.material('fronts');
  const boxMat = ctx.material('drawerBox');
  const bottomMat = ctx.material('drawerBottom');
  const parts: Part[] = [];
  for (const d of drawers) {
    const id = (name: string) => `drw:${d.drawerId}:${name}`;
    const owner = d.inner ? d.sectionId : d.drawerId;
    if (!d.inner) parts.push(makePart(id('front'), 'drawer-front', owner, fronts, makeBox(d.xL, d.xR, d.fb, d.ft, D, D + tFr)));
    const b = d.box;
    if (!b) continue;
    const zF = b.zFront;
    const z0 = zF - b.Ls;
    const y0 = b.yBox + tbt;
    const y1 = b.yBox + b.hBox;
    parts.push(
      makePart(id('sideL'), 'drawer-side', owner, boxMat, makeBox(b.x0, b.x0 + tb, y0, y1, z0, zF)),
      makePart(id('sideR'), 'drawer-side', owner, boxMat, makeBox(b.x1 - tb, b.x1, y0, y1, z0, zF)),
      makePart(id('inFront'), 'drawer-inner-front', owner, boxMat, makeBox(b.x0 + tb, b.x1 - tb, y0, y1, zF - tb, zF)),
      makePart(id('inBack'), 'drawer-inner-back', owner, boxMat, makeBox(b.x0 + tb, b.x1 - tb, y0, y1, z0, z0 + tb)),
      makePart(id('bottom'), 'drawer-bottom', owner, bottomMat, makeBox(b.x0, b.x1, b.yBox, b.yBox + tbt, z0, zF)),
    );
  }
  return parts;
}
