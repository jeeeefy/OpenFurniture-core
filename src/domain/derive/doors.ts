import { frontSpan, frontZone, type EdgeType } from '../layout/frontGrid';
import type { DeriveContext } from './context';
import { makeBox, makePart } from './frames';
import type { Part } from './model';

export interface DoorLeaf {
  id: string;
  sectionId: string;
  columnIndex: number;
  hinge: 'left' | 'right';
  /** Front-grid type of the hinge edge; `outer` and `full` mean full overlay. */
  hingeEdge: EdgeType;
  xL: number;
  xR: number;
  yB: number;
  yT: number;
  /** Fixed shelves behind a door spanning several sections (y ranges); hinge plates must avoid them. */
  coveredShelves: { y0: number; y1: number }[];
}

/** Single doors fill the zone; double doors split it at the centre with one gap (plan §4.4). */
export function doorLeaves(ctx: DeriveContext): DoorLeaf[] {
  const gap = ctx.doc.construction.frontGapMm;
  const leaves: DoorLeaf[] = [];
  ctx.doc.layout.columns.forEach((column, ci) => {
    column.sections.forEach((section, si) => {
      const front = section.front;
      if (front.kind !== 'door' && front.kind !== 'doubleDoor') return;
      const zone = frontZone(ctx.doc, ctx.layout, ctx.dims, ci, si);
      if (!zone) return;
      const { xL, xR, yB, yT, edges } = zone;
      const rc = ctx.layout.columns[ci];
      const last = Math.min(si + frontSpan(section) - 1, column.sections.length - 1);
      const coveredShelves = (rc?.sections.slice(si, last) ?? []).map((s) => ({ y0: s.y1, y1: s.y1 + ctx.dims.tF }));
      const base = { sectionId: section.id, columnIndex: ci, yB, yT, coveredShelves };
      if (front.kind === 'door') {
        leaves.push({
          ...base,
          id: `door:${section.id}:S`,
          hinge: front.hinge,
          hingeEdge: front.hinge === 'left' ? edges.left : edges.right,
          xL,
          xR,
        });
      } else {
        const xm = (xL + xR) / 2;
        leaves.push(
          { ...base, id: `door:${section.id}:L`, hinge: 'left', hingeEdge: edges.left, xL, xR: xm - gap / 2 },
          { ...base, id: `door:${section.id}:R`, hinge: 'right', hingeEdge: edges.right, xL: xm + gap / 2, xR },
        );
      }
    });
  });
  return leaves;
}

export function deriveDoors(ctx: DeriveContext): Part[] {
  const { D, tFr } = ctx.dims;
  const material = ctx.material('fronts');
  return doorLeaves(ctx).map((leaf) =>
    makePart(leaf.id, 'door', leaf.sectionId, material, makeBox(leaf.xL, leaf.xR, leaf.yB, leaf.yT, D, D + tFr)),
  );
}
