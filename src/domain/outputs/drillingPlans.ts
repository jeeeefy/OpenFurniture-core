import type { DesignDocument } from '../document/types';
import type { EdgeId, FurnitureModel, Hole, Mark, Part, PartRole } from '../derive/model';
import { roundTo01 } from '../units';
import type { PositionGroup } from './positions';

export type FaceSemantic = 'inner' | 'outer' | 'top' | 'underside' | 'left-face' | 'right-face' | 'front-face' | 'rear-face';
export type EdgeName = 'bottom' | 'top' | 'back' | 'front' | 'left' | 'right';

export interface PlanHole {
  ref: string;
  xMm: number;
  yMm: number;
  diameterMm: number;
  depth: number | 'through';
  countersinkDiameterMm: number | null;
  purpose: Hole['purpose'];
}

export interface PlanMark {
  ref: string;
  xMm: number;
  yMm: number;
  purpose: Mark['purpose'];
}

export interface PlanFace {
  face: 'A' | 'B';
  semantic: FaceSemantic;
  edgeNames: Record<EdgeId, EdgeName>;
  holes: PlanHole[];
  marks: PlanMark[];
}

export interface DrillingPlan {
  position: number;
  quantity: number;
  role: PartRole;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  faces: PlanFace[];
  bandedEdges: EdgeId[];
  /** Names of unverified profiles that place holes on this part (banner, AC-032). */
  unverifiedProfiles: string[];
}

/** Face A / B meaning per role (plan F.6). */
const FACE_SEMANTICS: Record<PartRole, [FaceSemantic, FaceSemantic]> = {
  'side-left': ['inner', 'outer'],
  'side-right': ['outer', 'inner'],
  top: ['top', 'underside'],
  bottom: ['top', 'underside'],
  divider: ['right-face', 'left-face'],
  'fixed-shelf': ['top', 'underside'],
  'adjustable-shelf': ['top', 'underside'],
  back: ['front-face', 'rear-face'],
  'plinth-side': ['right-face', 'left-face'],
  'plinth-front': ['front-face', 'rear-face'],
  'plinth-back': ['front-face', 'rear-face'],
  door: ['front-face', 'rear-face'],
  'drawer-front': ['front-face', 'rear-face'],
  'drawer-side': ['right-face', 'left-face'],
  'drawer-inner-front': ['front-face', 'rear-face'],
  'drawer-inner-back': ['front-face', 'rear-face'],
  'drawer-bottom': ['top', 'underside'],
};

/** Names of the u0 / u1 / v0 / v1 edges per role (plan F.6). */
const EDGE_NAMES: Record<PartRole, [EdgeName, EdgeName, EdgeName, EdgeName]> = {
  'side-left': ['bottom', 'top', 'back', 'front'],
  'side-right': ['bottom', 'top', 'back', 'front'],
  top: ['left', 'right', 'back', 'front'],
  bottom: ['left', 'right', 'back', 'front'],
  divider: ['bottom', 'top', 'back', 'front'],
  'fixed-shelf': ['left', 'right', 'back', 'front'],
  'adjustable-shelf': ['left', 'right', 'back', 'front'],
  back: ['bottom', 'top', 'left', 'right'],
  'plinth-side': ['back', 'front', 'bottom', 'top'],
  'plinth-front': ['left', 'right', 'bottom', 'top'],
  'plinth-back': ['left', 'right', 'bottom', 'top'],
  door: ['bottom', 'top', 'left', 'right'],
  'drawer-front': ['left', 'right', 'bottom', 'top'],
  'drawer-side': ['back', 'front', 'bottom', 'top'],
  'drawer-inner-front': ['left', 'right', 'bottom', 'top'],
  'drawer-inner-back': ['left', 'right', 'bottom', 'top'],
  'drawer-bottom': ['left', 'right', 'back', 'front'],
};

/** Edge names keyed by frame edge id, for editing and display outside the drilling plans. */
export function edgeNamesFor(role: PartRole): Record<EdgeId, EdgeName> {
  const [u0, u1, v0, v1] = EDGE_NAMES[role];
  return { u0, u1, v0, v1 };
}

function handleOfPart(doc: DesignDocument, part: Part): string | null {
  for (const column of doc.layout.columns) {
    for (const section of column.sections) {
      const front = section.front;
      if (front.kind === 'none') continue;
      const owns = section.id === part.ownerId || (front.kind === 'drawers' && front.drawers.some((d) => d.id === part.ownerId));
      if (owns) return front.handleId;
    }
  }
  return null;
}

function unverifiedProfiles(doc: DesignDocument, part: Part, holes: readonly Hole[]): string[] {
  const hw = doc.hardware;
  const names = new Set<string>();
  for (const hole of holes) {
    if (hole.profileKey === 'hinge' && !hw.hinge.verifiedByUser) names.add(hw.hinge.name);
    if (hole.profileKey === 'slide' && !hw.slide.verifiedByUser) names.add(hw.slide.name);
    if (hole.profileKey === 'handle') {
      const handle = hw.handles.find((h) => h.id === handleOfPart(doc, part));
      if (handle && !handle.verifiedByUser) names.add(handle.name);
    }
  }
  return [...names].sort();
}

/**
 * One plan per position with holes or marks, one view per face that has them. View frame: origin
 * bottom-left as seen looking at the face; face A x = u, face B x = length − u (mirrored), y = v.
 */
export function computeDrillingPlans(doc: DesignDocument, model: FurnitureModel, positions: readonly PositionGroup[]): DrillingPlan[] {
  const parts = new Map(model.parts.map((p) => [p.id, p]));
  const plans: DrillingPlan[] = [];
  for (const group of positions) {
    const partId = group.partIds[0];
    const part = partId ? parts.get(partId) : undefined;
    if (!part) continue;
    const holes = model.holes.filter((h) => h.partId === part.id);
    const marks = model.marks.filter((m) => m.partId === part.id);
    if (holes.length === 0 && marks.length === 0) continue;

    const view = (face: 'A' | 'B', u: number) => roundTo01(face === 'A' ? u : part.lengthMm - u);
    const byView = <T extends { xMm: number; yMm: number }>(a: T, b: T) => a.xMm - b.xMm || a.yMm - b.yMm;
    const [u0, u1, v0, v1] = EDGE_NAMES[part.role];
    const faces: PlanFace[] = (['A', 'B'] as const).flatMap((face, i) => {
      const faceHoles = holes
        .filter((h) => h.face === face)
        .map((h) => ({
          xMm: view(face, h.uMm),
          yMm: roundTo01(h.vMm),
          diameterMm: h.diameterMm,
          depth: h.depthMm,
          countersinkDiameterMm: h.countersinkDiameterMm,
          purpose: h.purpose,
        }))
        .sort(byView)
        .map((h, n) => ({ ref: `H${String(n + 1)}`, ...h }));
      const faceMarks = marks
        .filter((m) => m.face === face)
        .map((m) => ({ xMm: view(face, m.uMm), yMm: roundTo01(m.vMm), purpose: m.purpose }))
        .sort(byView)
        .map((m, n) => ({ ref: `M${String(n + 1)}`, ...m }));
      if (faceHoles.length === 0 && faceMarks.length === 0) return [];
      return [
        {
          face,
          semantic: FACE_SEMANTICS[part.role][i] ?? 'inner',
          edgeNames: { u0, u1, v0, v1 },
          holes: faceHoles,
          marks: faceMarks,
        },
      ];
    });

    plans.push({
      position: group.position,
      quantity: group.quantity,
      role: part.role,
      lengthMm: part.lengthMm,
      widthMm: part.widthMm,
      thicknessMm: part.thicknessMm,
      faces,
      bandedEdges: [...part.bandedEdges],
      unverifiedProfiles: unverifiedProfiles(doc, part, holes),
    });
  }
  return plans;
}
