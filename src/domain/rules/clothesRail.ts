import type { Vec3 } from '../derive/model';
import { issue } from '../validate/catalogue';
import { emptyOutput, toLocal, type RuleContext, type RuleOutput } from './common';

const SHALLOW_DEPTH_MM = 500;
const LONG_SPAN_MM = 1000;
const LOW_SECTION_MM = 800;

/** Plan §4.7.7: tube cut to the clear width minus end allowances, supports marked on both inner faces. */
export function deriveClothesRails(ctx: RuleContext): RuleOutput {
  const out = emptyOutput();
  const r = ctx.doc.hardware.clothesRail;
  const { D, tB, Dc } = ctx.dims;
  const columns = ctx.layout.columns;

  ctx.doc.layout.columns.forEach((column, ci) => {
    const resolved = columns[ci];
    if (!resolved) return;
    const left = ctx.parts.get(ci === 0 ? 'side:L' : `divider:${columns[ci - 1]?.id ?? ''}`);
    const right = ctx.parts.get(ci === columns.length - 1 ? 'side:R' : `divider:${column.id}`);
    column.sections.forEach((section, si) => {
      const rs = resolved.sections[si];
      if (!rs || section.interior.kind !== 'clothesRail' || !left || !right) return;
      const lengthMm = resolved.widthMm - 2 * r.endAllowanceMm;
      const point: Vec3 = [0, rs.y1 - r.centerBelowTopMm, (tB + D) / 2];
      out.marks.push(
        { partId: left.id, face: 'A', ...toLocal(left, point), purpose: 'rail-support' },
        { partId: right.id, face: 'B', ...toLocal(right, point), purpose: 'rail-support' },
      );
      const partIds = [left.id, right.id];
      out.hardware.push(
        {
          key: `rail:${String(Math.round(lengthMm * 10) / 10)}`,
          kind: 'rail',
          labelParams: { diameterMm: r.tubeDiameterMm, lengthMm },
          quantity: 1,
          unit: 'pcs',
          profileKey: 'clothesRail',
          partIds,
        },
        { key: 'rail-support', kind: 'rail-support', labelParams: {}, quantity: 2, unit: 'pcs', profileKey: 'clothesRail', partIds },
        {
          key: 'screw:clothesRail',
          kind: 'screw',
          labelParams: { label: r.screwLabel },
          quantity: 2 * r.screwsPerSupport,
          unit: 'pcs',
          profileKey: null,
          partIds,
        },
      );
      const target = { kind: 'section' as const, id: section.id, field: 'interior' };
      if (Dc < SHALLOW_DEPTH_MM) out.issues.push(issue('RAIL_SHALLOW_DEPTH', target, { depthMm: Dc, minMm: SHALLOW_DEPTH_MM }));
      if (lengthMm > LONG_SPAN_MM) out.issues.push(issue('RAIL_SPAN_LONG', target, { lengthMm, maxMm: LONG_SPAN_MM }));
      if (rs.heightMm < LOW_SECTION_MM) {
        out.issues.push(issue('RAIL_SECTION_LOW', target, { heightMm: rs.heightMm, minMm: LOW_SECTION_MM }));
      }
    });
  });
  return out;
}
