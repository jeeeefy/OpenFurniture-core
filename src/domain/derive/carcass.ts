import type { DeriveContext } from './context';
import { makeBox, makePart } from './frames';
import type { Part } from './model';

/** Sides full height; top and bottom between the sides; dividers between top and bottom (ADR-12). */
export function deriveCarcass(ctx: DeriveContext): Part[] {
  const { W, H, D, hP, t, tB } = ctx.dims;
  const mat = ctx.material('carcass');
  const parts = [
    makePart('side:L', 'side-left', 'carcass', mat, makeBox(0, t, hP, H, tB, D)),
    makePart('side:R', 'side-right', 'carcass', mat, makeBox(W - t, W, hP, H, tB, D)),
    makePart('top', 'top', 'carcass', mat, makeBox(t, W - t, H - t, H, tB, D)),
    makePart('bottom', 'bottom', 'carcass', mat, makeBox(t, W - t, hP, hP + t, tB, D)),
  ];
  const columns = ctx.layout.columns;
  for (const column of columns.slice(0, -1)) {
    parts.push(
      makePart(`divider:${column.id}`, 'divider', column.id, mat, makeBox(column.x1, column.x1 + t, hP + t, H - t, tB, D)),
    );
  }
  return parts;
}

export function deriveBack(ctx: DeriveContext): Part[] {
  const { W, H, hP, tB } = ctx.dims;
  return [makePart('back', 'back', 'back', ctx.material('back'), makeBox(0, W, hP, H, 0, tB))];
}
