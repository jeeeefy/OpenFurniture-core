import type { Material } from '../document/types';
import { roundTo01 } from '../units';
import type { Axis, Box, EdgeId, Frame, Part, PartRole, Vec3 } from './model';

/** Local frames per role (plan F.6); face A is the +w face. */
export const FRAMES: Record<PartRole, Frame> = {
  'side-left': { u: 'y', v: 'z', w: 'x' },
  'side-right': { u: 'y', v: 'z', w: 'x' },
  top: { u: 'x', v: 'z', w: 'y' },
  bottom: { u: 'x', v: 'z', w: 'y' },
  divider: { u: 'y', v: 'z', w: 'x' },
  'fixed-shelf': { u: 'x', v: 'z', w: 'y' },
  'adjustable-shelf': { u: 'x', v: 'z', w: 'y' },
  back: { u: 'y', v: 'x', w: 'z' },
  'plinth-side': { u: 'z', v: 'y', w: 'x' },
  'plinth-front': { u: 'x', v: 'y', w: 'z' },
  'plinth-back': { u: 'x', v: 'y', w: 'z' },
  door: { u: 'y', v: 'x', w: 'z' },
  'drawer-front': { u: 'x', v: 'y', w: 'z' },
  'drawer-side': { u: 'z', v: 'y', w: 'x' },
  'drawer-inner-front': { u: 'x', v: 'y', w: 'z' },
  'drawer-inner-back': { u: 'x', v: 'y', w: 'z' },
  'drawer-bottom': { u: 'x', v: 'z', w: 'y' },
};

const FRONT_EDGE_ROLES: ReadonlySet<PartRole> = new Set([
  'side-left',
  'side-right',
  'top',
  'bottom',
  'divider',
  'fixed-shelf',
  'adjustable-shelf',
]);
const ALL_EDGE_ROLES: ReadonlySet<PartRole> = new Set(['door', 'drawer-front']);

/** Default banded edges (plan F.6); only for materials with an edge band. */
export function defaultBandedEdges(role: PartRole, material: Material): EdgeId[] {
  if (material.edgeBand === null) return [];
  if (FRONT_EDGE_ROLES.has(role)) return ['v1'];
  if (ALL_EDGE_ROLES.has(role)) return ['u0', 'u1', 'v0', 'v1'];
  return [];
}

const AXIS_INDEX: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

export function extent(box: Box, axis: Axis): number {
  const i = AXIS_INDEX[axis];
  return box.max[i] - box.min[i];
}

export function makeBox(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Box {
  const min: Vec3 = [roundTo01(x0), roundTo01(y0), roundTo01(z0)];
  const max: Vec3 = [roundTo01(x1), roundTo01(y1), roundTo01(z1)];
  return { min, max };
}

export function makePart(id: string, role: PartRole, ownerId: string, material: Material, box: Box): Part {
  const frame = FRAMES[role];
  return {
    id,
    role,
    ownerId,
    materialId: material.id,
    lengthMm: roundTo01(extent(box, frame.u)),
    widthMm: roundTo01(extent(box, frame.v)),
    thicknessMm: roundTo01(extent(box, frame.w)),
    box,
    frame,
    bandedEdges: defaultBandedEdges(role, material),
  };
}

/** Finished size minus deducted band thickness on banded edges (plan F.6). */
export function cutSize(part: Part, material: Material): { lengthMm: number; widthMm: number } {
  const band = material.edgeBand;
  if (band === null || !band.deductFromCutSize) return { lengthMm: part.lengthMm, widthMm: part.widthMm };
  const count = (a: EdgeId, b: EdgeId) => (part.bandedEdges.includes(a) ? 1 : 0) + (part.bandedEdges.includes(b) ? 1 : 0);
  return {
    lengthMm: roundTo01(part.lengthMm - count('u0', 'u1') * band.thicknessMm),
    widthMm: roundTo01(part.widthMm - count('v0', 'v1') * band.thicknessMm),
  };
}
