import type { ConstructionSettings } from '../document/types';
import type { Hole, Part } from '../derive/model';
import { roundTo01 } from '../units';
import { issue, type ValidationIssue } from './catalogue';

type HoleGeometry = Pick<Hole, 'face' | 'uMm' | 'vMm' | 'diameterMm' | 'depthMm' | 'countersinkDiameterMm'>;

/** Radius a hole occupies on its drilled face; a countersink widens it (plan §4.7.3, §4.7.9). */
export function radiusOnFace(hole: HoleGeometry): number {
  return (hole.countersinkDiameterMm ?? hole.diameterMm) / 2;
}

/**
 * Same face: centre distance below r1 + r2 + spacing. Opposite faces: projected distance below that
 * value and either hole is through or both together leave too little material.
 */
export function holesConflict(
  a: HoleGeometry,
  b: HoleGeometry,
  thicknessMm: number,
  minHoleSpacingMm: number,
  minRemainingMaterialMm: number,
): boolean {
  const distance = Math.hypot(a.uMm - b.uMm, a.vMm - b.vMm);
  if (distance >= radiusOnFace(a) + radiusOnFace(b) + minHoleSpacingMm - 1e-9) return false;
  if (a.face === b.face) return true;
  if (a.depthMm === 'through' || b.depthMm === 'through') return true;
  return a.depthMm + b.depthMm > thicknessMm - minRemainingMaterialMm + 1e-9;
}

/** Plan §4.7.9 after pin suppression: edge distance for every hole, conflicts between non-pin holes. */
export function checkHoles(
  parts: readonly Part[],
  holes: readonly Hole[],
  construction: ConstructionSettings,
  cupEdgeDistanceMm: number,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byPart = new Map<string, Hole[]>();
  for (const hole of holes) byPart.set(hole.partId, [...(byPart.get(hole.partId) ?? []), hole]);

  for (const part of parts) {
    const own = byPart.get(part.id) ?? [];
    for (const hole of own) {
      const edge = Math.min(hole.uMm, part.lengthMm - hole.uMm, hole.vMm, part.widthMm - hole.vMm) - radiusOnFace(hole);
      const minimum =
        hole.purpose === 'hinge-cup' ? Math.min(construction.minHoleEdgeMaterialMm, cupEdgeDistanceMm) : construction.minHoleEdgeMaterialMm;
      if (edge < minimum - 1e-6) {
        issues.push(
          issue('HOLE_TOO_CLOSE_TO_EDGE', { kind: 'part', id: part.id }, { holeId: hole.id, edgeMaterialMm: roundTo01(edge), minMm: minimum }),
        );
      }
    }
    const nonPin = own.filter((h) => h.purpose !== 'shelf-pin');
    for (let i = 0; i < nonPin.length; i += 1) {
      for (let j = i + 1; j < nonPin.length; j += 1) {
        const a = nonPin[i];
        const b = nonPin[j];
        if (!a || !b) continue;
        if (holesConflict(a, b, part.thicknessMm, construction.minHoleSpacingMm, construction.minRemainingMaterialMm)) {
          issues.push(issue('HOLE_CONFLICT', { kind: 'part', id: part.id }, { holeId: a.id, otherHoleId: b.id }));
        }
      }
    }
  }
  return issues;
}
