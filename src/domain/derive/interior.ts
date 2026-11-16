import { behindDoor } from '../layout/frontGrid';
import { pinRowHeights } from '../rules/shelfPins';
import { EPS } from '../units';
import type { DeriveContext } from './context';
import { makeBox, makePart } from './frames';
import type { Part, RailFitting, ResolvedSection } from './model';

/** Plan §4.7.7: tube between the column boundaries minus the end allowances, centre below the panel above. */
export function railFittings(ctx: DeriveContext): RailFitting[] {
  const r = ctx.doc.hardware.clothesRail;
  const { D, tB } = ctx.dims;
  return ctx.doc.layout.columns.flatMap((column, ci) => {
    const rc = ctx.layout.columns[ci];
    if (!rc) return [];
    return column.sections.flatMap((section, si) => {
      const rs = rc.sections[si];
      if (!rs || section.interior.kind !== 'clothesRail') return [];
      return [
        {
          sectionId: section.id,
          x0: rc.x0 + r.endAllowanceMm,
          x1: rc.x1 - r.endAllowanceMm,
          y: rs.y1 - r.centerBelowTopMm,
          z: (tB + D) / 2,
          diameterMm: r.tubeDiameterMm,
        },
      ];
    });
  });
}

/** Bottom faces of the k shelves: each rests on the pin row nearest to its target height. */
function shelfBottoms(
  ctx: DeriveContext,
  rs: ResolvedSection,
  columnIndex: number,
  count: number,
  positionsMm?: readonly number[],
): number[] {
  const sp = ctx.doc.hardware.shelfPin;
  const tF = ctx.dims.tF;
  const rests = pinRowHeights(rs, columnIndex, sp).map((y) => y + sp.holeDiameterMm / 2);
  const bottoms: number[] = [];
  let floor = rs.y0;

  // L-17: custom bottom heights above the section floor, snapped to the nearest usable pin row.
  if (positionsMm && positionsMm.length === count) {
    for (const offset of [...positionsMm].sort((a, b) => a - b)) {
      const target = rs.y0 + offset;
      let best: number | null = null;
      for (const rest of rests) {
        if (rest < floor - EPS || rest + tF > rs.y1 + EPS) continue;
        if (best === null || Math.abs(rest - target) < Math.abs(best - target) - EPS) best = rest;
      }
      const bottom = best ?? Math.min(Math.max(target, floor), rs.y1 - tF);
      bottoms.push(bottom);
      floor = bottom + tF;
    }
    return bottoms;
  }

  for (let j = 1; j <= count; j += 1) {
    const target = rs.y0 + (j * rs.heightMm) / (count + 1);
    let best: number | null = null;
    for (const rest of rests) {
      if (rest < floor - EPS || rest + tF > rs.y1 + EPS) continue;
      if (best === null || Math.abs(rest - target) < Math.abs(best - target) - EPS) best = rest;
    }
    const bottom = best ?? Math.min(Math.max(target, floor), rs.y1 - tF);
    bottoms.push(bottom);
    floor = bottom + tF;
  }
  return bottoms;
}

export function deriveInterior(ctx: DeriveContext): Part[] {
  const { D, tB, tF } = ctx.dims;
  const sp = ctx.doc.hardware.shelfPin;
  const shelves = ctx.material('shelves');
  const parts: Part[] = [];

  ctx.doc.layout.columns.forEach((column, ci) => {
    const rc = ctx.layout.columns[ci];
    if (!rc) return;
    column.sections.forEach((section, si) => {
      const rs = rc.sections[si];
      if (!rs) return;
      if (si < column.sections.length - 1) {
        parts.push(
          makePart(`fixed:${section.id}`, 'fixed-shelf', section.id, shelves, makeBox(rc.x0, rc.x1, rs.y1, rs.y1 + tF, tB, D)),
        );
      }
      if (section.interior.kind === 'adjustableShelves') {
        const front = behindDoor(column.sections, si) ? sp.shelfFrontSetbackDoorMm : sp.shelfFrontSetbackOpenMm;
        const x0 = rc.x0 + sp.shelfSideClearanceMm;
        const x1 = rc.x1 - sp.shelfSideClearanceMm;
        const z0 = tB + sp.shelfRearClearanceMm;
        const z1 = D - front;
        shelfBottoms(ctx, rs, ci, section.interior.count, section.interior.positionsMm).forEach((y, j) => {
          parts.push(
            makePart(`adj:${section.id}:${j + 1}`, 'adjustable-shelf', section.id, shelves, makeBox(x0, x1, y, y + tF, z0, z1)),
          );
        });
      }
    });
  });
  return parts;
}
