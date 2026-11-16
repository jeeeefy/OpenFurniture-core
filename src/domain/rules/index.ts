import type { Hole, Mark, Part } from '../derive/model';
import { roundTo01 } from '../units';
import { deriveBackFasteners } from './backFasteners';
import { deriveClothesRails } from './clothesRail';
import { mergeOutputs, type RawHole, type RawMark, type RuleContext, type RuleOutput } from './common';
import { deriveDrawerRules } from './drawers';
import { deriveFrontAttachment, deriveHandles } from './handles';
import { deriveHinges } from './hinges';
import { deriveScrewJoints, derivePlinthBrackets } from './screwJoinery';
import { deriveShelfPins } from './shelfPins';
import { checkNarrowCompartments, checkToolAccess, checkUnverifiedProfiles } from './toolAccess';
import { checkHoles } from '../validate/holeChecks';

export interface RulesResult extends Omit<RuleOutput, 'holes' | 'marks'> {
  holes: Hole[];
  marks: Mark[];
}

function byPosition(a: { face: 'A' | 'B'; uMm: number; vMm: number }, b: { face: 'A' | 'B'; uMm: number; vMm: number }) {
  if (a.face !== b.face) return a.face < b.face ? -1 : 1;
  if (a.uMm !== b.uMm) return a.uMm - b.uMm;
  return a.vMm - b.vMm;
}

/** Ids `<partId>#<purpose>#<n>`, numbered after sorting by face, then u, then v (plan F.6). */
function assignIds<T extends RawHole | RawMark>(items: readonly T[], partOrder: ReadonlyMap<string, number>): (T & { id: string })[] {
  const rounded = items.map((item) => ({ ...item, uMm: roundTo01(item.uMm), vMm: roundTo01(item.vMm) }));
  rounded.sort((a, b) => {
    const part = (partOrder.get(a.partId) ?? 0) - (partOrder.get(b.partId) ?? 0);
    if (part !== 0) return part;
    if (a.purpose !== b.purpose) return a.purpose < b.purpose ? -1 : 1;
    return byPosition(a, b);
  });
  const counters = new Map<string, number>();
  return rounded.map((item) => {
    const group = `${item.partId}#${item.purpose}`;
    const n = (counters.get(group) ?? 0) + 1;
    counters.set(group, n);
    return { ...item, id: `${group}#${String(n)}` };
  });
}

/** Construction rules of plan §4.7 for carcass, plinth, back, shelf pins and rails. */
export function applyRules(ctx: RuleContext, parts: readonly Part[]): RulesResult {
  const structural = mergeOutputs(
    deriveScrewJoints(ctx),
    derivePlinthBrackets(ctx),
    deriveBackFasteners(ctx),
    deriveClothesRails(ctx),
    deriveHinges(ctx),
    deriveDrawerRules(ctx),
    deriveHandles(ctx),
    deriveFrontAttachment(ctx),
  );
  const pins = deriveShelfPins(ctx, structural.holes);
  const all = mergeOutputs(structural, pins);
  all.issues.push(...checkToolAccess(ctx), ...checkNarrowCompartments(ctx), ...checkUnverifiedProfiles(ctx));

  const partOrder = new Map(parts.map((p, i) => [p.id, i]));
  const holes = assignIds(all.holes, partOrder);
  all.issues.push(...checkHoles(parts, holes, ctx.doc.construction, ctx.doc.hardware.hinge.cupEdgeDistanceMm));
  return { ...all, holes, marks: assignIds(all.marks, partOrder) };
}
