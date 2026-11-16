import { doorLeaves } from '../derive/doors';
import type { Vec3 } from '../derive/model';
import { issue } from '../validate/catalogue';
import { emptyOutput, toLocal, type RuleContext, type RuleOutput } from './common';

/** TYPICAL: the mounting plate body reaches this far beyond its outer screw holes. */
const PLATE_BODY_MARGIN_MM = 20;

/** Cup centres: edge offset from both ends, the rest evenly between (plan §4.7.4). */
export function hingePositions(yB: number, yT: number, count: number, edgeOffsetMm: number): number[] {
  const first = yB + edgeOffsetMm;
  const last = yT - edgeOffsetMm;
  return Array.from({ length: count }, (_, i) => first + (i * (last - first)) / (count - 1));
}

/** Moves hinges whose mounting plate would sit on a covered fixed shelf to the nearer side of that shelf. */
export function avoidShelves(
  centres: readonly number[],
  shelves: readonly { y0: number; y1: number }[],
  plateOffsets: readonly number[],
): number[] {
  const below = Math.min(...plateOffsets) - PLATE_BODY_MARGIN_MM;
  const above = Math.max(...plateOffsets) + PLATE_BODY_MARGIN_MM;
  return centres.map((y) => {
    const shelf = shelves.find((s) => y + above > s.y0 && y + below < s.y1);
    if (!shelf) return y;
    const under = shelf.y0 - above;
    const over = shelf.y1 - below;
    return Math.abs(under - y) <= Math.abs(over - y) ? under : over;
  });
}

export function deriveHinges(ctx: RuleContext): RuleOutput {
  const out = emptyOutput();
  const h = ctx.doc.hardware.hinge;
  const c = ctx.doc.construction;
  const { D } = ctx.dims;
  const columns = ctx.layout.columns;
  const plateSpread = Math.max(...h.plate.holeOffsetsAlongMm) - Math.min(...h.plate.holeOffsetsAlongMm);
  const cupFromEdge = h.cupEdgeDistanceMm + h.cupDiameterMm / 2;

  for (const leaf of doorLeaves(ctx)) {
    const door = ctx.parts.get(leaf.id);
    const rc = columns[leaf.columnIndex];
    if (!door || !rc) continue;
    const target = { kind: 'section' as const, id: leaf.sectionId, field: 'front' };
    const height = leaf.yT - leaf.yB;
    const width = leaf.xR - leaf.xL;

    if (width < c.minDoorWidthMm) out.issues.push(issue('DOOR_TOO_NARROW', target, { widthMm: width, minMm: c.minDoorWidthMm }));
    if (width > h.maxDoorWidthMm) out.issues.push(issue('DOOR_WIDE', target, { widthMm: width, maxMm: h.maxDoorWidthMm }));

    const variant = leaf.hingeEdge === 'half' ? 'half' : 'full';
    const overlay = leaf.hinge === 'left' ? rc.x0 - leaf.xL : leaf.xR - rc.x1;
    const [minOverlay, maxOverlay] = h.overlayRangesMm[variant];
    if (overlay < minOverlay - 1e-6 || overlay > maxOverlay + 1e-6) {
      out.issues.push(
        issue('HINGE_OVERLAY_UNSUPPORTED', target, { overlayMm: overlay, variant, minMm: minOverlay, maxMm: maxOverlay }),
      );
    }

    const row = h.countByHeight.find((r) => height <= r.maxDoorHeightMm + 1e-6);
    if (!row) {
      out.issues.push(issue('DOOR_TOO_TALL', target, { heightMm: height, maxMm: h.countByHeight.at(-1)?.maxDoorHeightMm ?? 0 }));
      continue;
    }
    const minHeight = 2 * h.edgeOffsetMm + plateSpread;
    if (height < minHeight - 1e-6) {
      out.issues.push(issue('DOOR_TOO_SHORT_FOR_HINGES', target, { heightMm: height, minMm: minHeight }));
      continue;
    }

    const plateId = leaf.hinge === 'left'
      ? leaf.columnIndex === 0 ? 'side:L' : `divider:${columns[leaf.columnIndex - 1]?.id ?? ''}`
      : leaf.columnIndex === columns.length - 1 ? 'side:R' : `divider:${rc.id}`;
    const plateFace = leaf.hinge === 'left' ? 'A' : 'B';
    const plateBoundary = ctx.parts.get(plateId);
    // Cup bores are measured from the hinge edge of the leaf; v runs left → right on the door.
    const cupV = leaf.hinge === 'left' ? cupFromEdge : width - cupFromEdge;
    const inward = leaf.hinge === 'left' ? 1 : -1;
    const centres = avoidShelves(
      hingePositions(leaf.yB, leaf.yT, row.count, h.edgeOffsetMm),
      leaf.coveredShelves,
      h.plate.holeOffsetsAlongMm,
    );

    for (const y of centres) {
      const cupU = y - leaf.yB;
      out.holes.push({
        partId: door.id,
        face: 'B',
        uMm: cupU,
        vMm: cupV,
        diameterMm: h.cupDiameterMm,
        depthMm: h.cupDepthMm,
        countersinkDiameterMm: null,
        purpose: 'hinge-cup',
        profileKey: 'hinge',
        jointId: null,
      });
      for (const fix of h.cupFixingHoles) {
        out.holes.push({
          partId: door.id,
          face: 'B',
          uMm: cupU + fix.offsetAlongMm,
          vMm: cupV + inward * fix.offsetInwardMm,
          diameterMm: fix.diameterMm,
          depthMm: fix.depthMm,
          countersinkDiameterMm: null,
          purpose: 'hinge-cup-fixing',
          profileKey: 'hinge',
          jointId: null,
        });
      }
      if (plateBoundary) {
        for (const offset of h.plate.holeOffsetsAlongMm) {
          const point: Vec3 = [0, y + offset, D - h.plate.setbackFromFrontMm];
          out.holes.push({
            partId: plateBoundary.id,
            face: plateFace,
            ...toLocal(plateBoundary, point),
            diameterMm: h.plate.holeDiameterMm,
            depthMm: h.plate.holeDepthMm,
            countersinkDiameterMm: null,
            purpose: 'hinge-plate',
            profileKey: 'hinge',
            jointId: null,
          });
        }
      }
    }

    const partIds = plateBoundary ? [door.id, plateBoundary.id] : [door.id];
    const plateHoles = row.count * h.plate.holeOffsetsAlongMm.length;
    out.hardware.push(
      {
        key: `hinge:${variant}`,
        kind: 'hinge',
        labelParams: { name: h.name, variant },
        quantity: row.count,
        unit: 'pcs',
        profileKey: 'hinge',
        partIds,
      },
      { key: 'hinge-plate', kind: 'hinge-plate', labelParams: { name: h.name }, quantity: row.count, unit: 'pcs', profileKey: 'hinge', partIds },
      {
        key: 'hinge-screw',
        kind: 'screw',
        labelParams: { label: h.screwLabel },
        quantity: h.cupScrewsPerHinge * row.count + plateHoles,
        unit: 'pcs',
        profileKey: null,
        partIds,
      },
    );
  }
  return out;
}
