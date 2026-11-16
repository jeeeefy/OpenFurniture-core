import type { DesignDocument } from '../document/types';
import type { EdgeId, PartRole } from '../derive/model';
import type { PositionGroup } from './positions';
import { ceilSafe } from '../units';

export interface CutListRow {
  position: number;
  role: PartRole;
  quantity: number;
  partIds: string[];
  finished: { lengthMm: number; widthMm: number; thicknessMm: number };
  cut: { lengthMm: number; widthMm: number };
  grain: 'length' | 'none';
  bandedEdges: { u: 0 | 1 | 2; v: 0 | 1 | 2 };
}

export interface CutListGroup {
  materialId: string;
  rows: CutListRow[];
}

function countEdges(edges: readonly EdgeId[], a: EdgeId, b: EdgeId): 0 | 1 | 2 {
  return ((edges.includes(a) ? 1 : 0) + (edges.includes(b) ? 1 : 0)) as 0 | 1 | 2;
}

/** Grouped by material in the order of the design's materials, rows by position (AC-027). */
export function computeCutList(doc: DesignDocument, positions: readonly PositionGroup[]): CutListGroup[] {
  return doc.materials
    .map((material) => ({
      materialId: material.id,
      rows: positions
        .filter((p) => p.materialId === material.id)
        .map(
          (p): CutListRow => ({
            position: p.position,
            role: p.role,
            quantity: p.quantity,
            partIds: p.partIds,
            finished: p.finished,
            cut: p.cut,
            grain: material.hasGrain ? 'length' : 'none',
            // u edges sit at the ends of the length axis, v edges along it.
            bandedEdges: { u: countEdges(p.bandedEdges, 'u0', 'u1'), v: countEdges(p.bandedEdges, 'v0', 'v1') },
          }),
        ),
    }))
    .filter((group) => group.rows.length > 0);
}

export interface MaterialArea {
  materialId: string;
  parts: number;
  /** Cut sizes × quantity in m², rounded up to 0.01; no waste, kerf or sheet layout (L-01). */
  areaM2: number;
}

export function computeMaterialAreas(cutList: readonly CutListGroup[]): MaterialArea[] {
  return cutList.map((group) => {
    const mm2 = group.rows.reduce((sum, r) => sum + r.cut.lengthMm * r.cut.widthMm * r.quantity, 0);
    return {
      materialId: group.materialId,
      parts: group.rows.reduce((n, r) => n + r.quantity, 0),
      areaM2: ceilSafe(mm2 / 10_000) / 100,
    };
  });
}

/** Σ banded edge lengths per material in mm (without waste). */
export function bandedLengthByMaterial(positions: readonly PositionGroup[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const p of positions) {
    const perPart =
      countEdges(p.bandedEdges, 'u0', 'u1') * p.finished.widthMm + countEdges(p.bandedEdges, 'v0', 'v1') * p.finished.lengthMm;
    if (perPart > 0) totals.set(p.materialId, (totals.get(p.materialId) ?? 0) + perPart * p.quantity);
  }
  return totals;
}
