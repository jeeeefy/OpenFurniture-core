import type { Vec3 } from '../derive/model';
import { emptyOutput, fastenerPositions, screwItem, toLocal, type RuleContext, type RuleOutput } from './common';

/** Plan §4.7.2: nails become marks, screws become countersunk clearance holes, all on back face B. */
export function deriveBackFasteners(ctx: RuleContext): RuleOutput {
  const out = emptyOutput();
  const back = ctx.parts.get('back');
  if (!back) return out;
  const hw = ctx.doc.hardware;
  const { W, H, hP, t, tF } = ctx.dims;
  const points: Vec3[] = [];
  const vertical = (x: number, y0: number, y1: number) => {
    for (const p of fastenerPositions(y1 - y0, hw.backFastenerEndOffsetMm, hw.backFastenerSpacingMm)) points.push([x, y0 + p, 0]);
  };
  const horizontal = (y: number, x0: number, x1: number) => {
    for (const p of fastenerPositions(x1 - x0, hw.backFastenerEndOffsetMm, hw.backFastenerSpacingMm)) points.push([x0 + p, y, 0]);
  };

  vertical(t / 2, hP, H);
  vertical(W - t / 2, hP, H);
  horizontal(H - t / 2, t, W - t);
  horizontal(hP + t / 2, t, W - t);
  const columns = ctx.layout.columns;
  for (const column of columns.slice(0, -1)) vertical(column.x1 + t / 2, hP + t, H - t);
  for (const column of columns) {
    for (const section of column.sections.slice(0, -1)) horizontal(section.y1 + tF / 2, column.x0, column.x1);
  }

  if (ctx.doc.carcass.back.fastener === 'nail') {
    for (const point of points) out.marks.push({ partId: back.id, face: 'B', ...toLocal(back, point), purpose: 'back-nail' });
    out.hardware.push({
      key: 'back:nail',
      kind: 'nail',
      labelParams: { label: hw.backNailLabel },
      quantity: points.length,
      unit: 'pcs',
      profileKey: null,
      partIds: [back.id],
    });
  } else {
    for (const point of points) {
      out.holes.push({
        partId: back.id,
        face: 'B',
        ...toLocal(back, point),
        diameterMm: hw.backScrew.clearanceHoleMm,
        depthMm: 'through',
        countersinkDiameterMm: hw.backScrew.countersinkDiameterMm,
        purpose: 'back-screw',
        profileKey: null,
        jointId: null,
      });
    }
    out.hardware.push(screwItem(hw, 'backScrew', points.length, [back.id]));
  }
  return out;
}
