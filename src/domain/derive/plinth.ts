import type { DesignDocument } from '../document/types';
import { CARCASS_TARGET_ID } from '../layout/resolveLayout';
import { issue, type ValidationIssue } from '../validate/catalogue';
import type { DeriveContext } from './context';
import { makeBox, makePart } from './frames';
import type { Part } from './model';

const PLINTH_HEIGHT = { min: 50, max: 200 };
const MIN_FRAME_WIDTH = 200;
const MIN_FRAME_DEPTH = 150;

/** PLINTH_DIMENSION_INVALID checks of plan §4.7.8. */
export function checkPlinth(doc: DesignDocument): ValidationIssue[] {
  const base = doc.carcass.base;
  if (base.kind !== 'plinth') return [];
  const { widthMm: W, depthMm: D } = doc.carcass;
  const frameWidth = W - 2 * base.setbackSidesMm;
  const frameDepth = D - base.setbackFrontMm - base.setbackBackMm;
  const target = { kind: 'carcass' as const, id: CARCASS_TARGET_ID, field: 'base' };
  const issues: ValidationIssue[] = [];
  if (base.heightMm < PLINTH_HEIGHT.min || base.heightMm > PLINTH_HEIGHT.max) {
    issues.push(issue('PLINTH_DIMENSION_INVALID', target, { reason: 'height', valueMm: base.heightMm }));
  }
  if (frameWidth < MIN_FRAME_WIDTH) {
    issues.push(issue('PLINTH_DIMENSION_INVALID', target, { reason: 'width', valueMm: frameWidth }));
  }
  if (frameDepth < MIN_FRAME_DEPTH) {
    issues.push(issue('PLINTH_DIMENSION_INVALID', target, { reason: 'depth', valueMm: frameDepth }));
  }
  return issues;
}

/** Plinth frame rails; only derived for a valid plinth so that no rail has a non-positive size. */
export function derivePlinth(ctx: DeriveContext): Part[] {
  const base = ctx.doc.carcass.base;
  if (base.kind !== 'plinth' || checkPlinth(ctx.doc).length > 0) return [];
  const { W, D, hP, tP } = ctx.dims;
  const { setbackSidesMm: sS, setbackBackMm: sB, setbackFrontMm: sF } = base;
  const mat = ctx.material('plinth');
  return [
    makePart('plinth:L', 'plinth-side', 'plinth', mat, makeBox(sS, sS + tP, 0, hP, sB, D - sF)),
    makePart('plinth:R', 'plinth-side', 'plinth', mat, makeBox(W - sS - tP, W - sS, 0, hP, sB, D - sF)),
    makePart('plinth:F', 'plinth-front', 'plinth', mat, makeBox(sS + tP, W - sS - tP, 0, hP, D - sF - tP, D - sF)),
    makePart('plinth:B', 'plinth-back', 'plinth', mat, makeBox(sS + tP, W - sS - tP, 0, hP, sB, sB + tP)),
  ];
}
