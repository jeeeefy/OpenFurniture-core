import type { DesignDocument } from '../document/types';
import { cutSize } from '../derive/frames';
import { PART_ROLE_ORDER, type EdgeId, type FurnitureModel, type Part, type PartRole } from '../derive/model';
import { materialById } from '../layout/resolveLayout';

export interface PositionGroup {
  position: number;
  role: PartRole;
  materialId: string;
  quantity: number;
  partIds: string[];
  finished: { lengthMm: number; widthMm: number; thicknessMm: number };
  cut: { lengthMm: number; widthMm: number };
  bandedEdges: EdgeId[];
}

const ROLE_RANK = new Map(PART_ROLE_ORDER.map((role, i) => [role, i]));

function compareBoxMin(a: Part, b: Part): number {
  for (let i = 0; i < 3; i += 1) {
    const d = (a.box.min[i] ?? 0) - (b.box.min[i] ?? 0);
    if (d !== 0) return d;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Hole and mark lists relative to the part; identical parts must have identical drilling. */
function drillingSignature(model: FurnitureModel, partId: string): string {
  const holes = model.holes
    .filter((h) => h.partId === partId)
    .map((h) => [h.face, h.uMm, h.vMm, h.diameterMm, h.depthMm, h.countersinkDiameterMm, h.purpose, h.profileKey].join(':'))
    .sort();
  const marks = model.marks
    .filter((m) => m.partId === partId)
    .map((m) => [m.face, m.uMm, m.vMm, m.purpose].join(':'))
    .sort();
  return `${holes.join('|')}#${marks.join('|')}`;
}

/** Plan F.6: group identical parts, order by role then by the first part's box.min, number 1…N. */
export function computePositions(doc: DesignDocument, model: FurnitureModel): PositionGroup[] {
  const groups = new Map<string, { parts: Part[]; group: Omit<PositionGroup, 'position' | 'quantity' | 'partIds'> }>();
  for (const part of [...model.parts].sort(compareBoxMin)) {
    const material = materialById(doc, part.materialId);
    if (!material) continue;
    const cut = cutSize(part, material);
    const bandedEdges = [...part.bandedEdges].sort();
    const key = [
      part.role,
      part.materialId,
      part.lengthMm,
      part.widthMm,
      part.thicknessMm,
      cut.lengthMm,
      cut.widthMm,
      bandedEdges.join(','),
      drillingSignature(model, part.id),
    ].join('/');
    const existing = groups.get(key);
    if (existing) {
      existing.parts.push(part);
    } else {
      groups.set(key, {
        parts: [part],
        group: {
          role: part.role,
          materialId: part.materialId,
          finished: { lengthMm: part.lengthMm, widthMm: part.widthMm, thicknessMm: part.thicknessMm },
          cut,
          bandedEdges,
        },
      });
    }
  }

  return [...groups.values()]
    .sort((a, b) => {
      const rank = (ROLE_RANK.get(a.group.role) ?? 0) - (ROLE_RANK.get(b.group.role) ?? 0);
      const [pa] = a.parts;
      const [pb] = b.parts;
      return rank !== 0 || !pa || !pb ? rank : compareBoxMin(pa, pb);
    })
    .map(({ parts, group }, i) => ({
      position: i + 1,
      ...group,
      quantity: parts.length,
      partIds: parts.map((p) => p.id),
    }));
}

export function positionByPartId(positions: readonly PositionGroup[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const group of positions) for (const id of group.partIds) map.set(id, group.position);
  return map;
}
