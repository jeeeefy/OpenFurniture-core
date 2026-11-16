import type { HardwareProfiles } from '../document/types';
import type { DeriveContext } from '../derive/context';
import type { DrawerLayout } from '../derive/drawers';
import type { Hole, HardwareItem, Joint, Mark, Part, Vec3 } from '../derive/model';
import { ceilSafe } from '../units';
import type { ValidationIssue } from '../validate/catalogue';

export type RawHole = Omit<Hole, 'id'>;
export type RawMark = Omit<Mark, 'id'>;

/** Everything a construction rule contributes to the model; ids are assigned afterwards. */
export interface RuleOutput {
  holes: RawHole[];
  marks: RawMark[];
  joints: Joint[];
  hardware: HardwareItem[];
  issues: ValidationIssue[];
}

export function emptyOutput(): RuleOutput {
  return { holes: [], marks: [], joints: [], hardware: [], issues: [] };
}

export function mergeOutputs(...outputs: RuleOutput[]): RuleOutput {
  const merged = emptyOutput();
  for (const o of outputs) {
    merged.holes.push(...o.holes);
    merged.marks.push(...o.marks);
    merged.joints.push(...o.joints);
    merged.hardware.push(...o.hardware);
    merged.issues.push(...o.issues);
  }
  return merged;
}

export interface RuleContext extends DeriveContext {
  parts: ReadonlyMap<string, Part>;
  drawers: readonly DrawerLayout[];
}

const AXIS = { x: 0, y: 1, z: 2 } as const;

/** Local (u, v) of a world point on the part (origin at box.min). */
export function toLocal(part: Part, point: Vec3): { uMm: number; vMm: number } {
  const u = AXIS[part.frame.u];
  const v = AXIS[part.frame.v];
  return { uMm: point[u] - part.box.min[u], vMm: point[v] - part.box.min[v] };
}

/** Plan §4.7.1: positions along a joint line of length L, measured from its back, bottom or left end. */
export function screwPositions(lengthMm: number, edgeDistanceMm: number, maxSpacingMm: number): number[] {
  const e = Math.min(edgeDistanceMm, lengthMm / 4);
  const n = Math.max(2, ceilSafe((lengthMm - 2 * e) / maxSpacingMm) + 1);
  return Array.from({ length: n }, (_, i) => e + (i * (lengthMm - 2 * e)) / (n - 1));
}

/** Plan §4.7.2: evenly spaced points from the end offset to L − end offset. */
export function fastenerPositions(lengthMm: number, endOffsetMm: number, spacingMm: number): number[] {
  const n = Math.max(2, ceilSafe((lengthMm - 2 * endOffsetMm) / spacingMm) + 1);
  return Array.from({ length: n }, (_, i) => endOffsetMm + (i * (lengthMm - 2 * endOffsetMm)) / (n - 1));
}

export type ScrewKey = 'carcassScrew' | 'plinthScrew' | 'drawerBoxScrew' | 'drawerBottomScrew' | 'frontScrew' | 'backScrew';

export function screwItem(
  hardware: HardwareProfiles,
  key: ScrewKey,
  quantity: number,
  partIds: string[],
): HardwareItem {
  return {
    key: `screw:${key}`,
    kind: 'screw',
    labelParams: { label: hardware[key].label },
    quantity,
    unit: 'pcs',
    profileKey: null,
    partIds,
  };
}
