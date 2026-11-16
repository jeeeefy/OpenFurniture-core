import type { ShelfPinProfile } from '../document/types';
import type { ResolvedSection, Vec3 } from '../derive/model';
import { holesConflict } from '../validate/holeChecks';
import { emptyOutput, toLocal, type RawHole, type RuleContext, type RuleOutput } from './common';

/**
 * Pin row heights of a section. Every second column (index 1, 3, 5) is shifted by pitch/2 on both
 * of its boundary faces, so both faces of a divider never oppose each other while each section's
 * rows stay level (deviation from plan F.7, recorded in docs/progress.md).
 */
export function pinRowHeights(section: ResolvedSection, columnIndex: number, sp: ShelfPinProfile): number[] {
  const shift = columnIndex % 2 === 1 ? sp.pitchMm / 2 : 0;
  const first = section.y0 + sp.marginMm + shift;
  const last = section.y1 - sp.marginMm;
  const rows: number[] = [];
  for (let y = first, k = 0; y <= last + 1e-9; k += 1, y = first + k * sp.pitchMm) rows.push(y);
  return rows;
}

/**
 * Plan §4.7.3: two pin rows on both boundary faces of each section with adjustable shelves. Pins that
 * conflict with a non-pin hole (same face, or through the thickness) are suppressed.
 */
export function deriveShelfPins(ctx: RuleContext, nonPinHoles: readonly RawHole[]): RuleOutput {
  const out = emptyOutput();
  const sp = ctx.doc.hardware.shelfPin;
  const c = ctx.doc.construction;
  const { D, tB } = ctx.dims;
  const columns = ctx.layout.columns;
  const rowsZ = [tB + sp.rowSetbackMm, D - sp.rowSetbackMm];

  ctx.doc.layout.columns.forEach((column, ci) => {
    const resolved = columns[ci];
    if (!resolved) return;
    const leftId = ci === 0 ? 'side:L' : `divider:${columns[ci - 1]?.id ?? ''}`;
    const rightId = ci === columns.length - 1 ? 'side:R' : `divider:${column.id}`;
    column.sections.forEach((section, si) => {
      const rs = resolved.sections[si];
      if (!rs || section.interior.kind !== 'adjustableShelves') return;
      out.hardware.push({
        key: 'shelf-pin',
        kind: 'shelf-pin',
        labelParams: { diameterMm: sp.holeDiameterMm },
        quantity: sp.pinsPerShelf * section.interior.count,
        unit: 'pcs',
        profileKey: null,
        partIds: [leftId, rightId],
      });
      for (const [partId, face] of [
        [leftId, 'A'],
        [rightId, 'B'],
      ] as const) {
        const part = ctx.parts.get(partId);
        if (!part) continue;
        const others = nonPinHoles.filter((h) => h.partId === partId);
        for (const y of pinRowHeights(rs, ci, sp)) {
          for (const z of rowsZ) {
            const point: Vec3 = [0, y, z];
            const pin: RawHole = {
              partId,
              face,
              ...toLocal(part, point),
              diameterMm: sp.holeDiameterMm,
              depthMm: sp.holeDepthMm,
              countersinkDiameterMm: null,
              purpose: 'shelf-pin',
              profileKey: 'shelfPin',
              jointId: null,
            };
            const suppressed = others.some((h) =>
              holesConflict(pin, h, part.thicknessMm, c.minHoleSpacingMm, c.minRemainingMaterialMm),
            );
            if (!suppressed) out.holes.push(pin);
          }
        }
      }
    });
  });
  return out;
}
