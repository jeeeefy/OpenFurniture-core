import { LIMITS } from '../document/limits';
import type { Base, MaterialGroup } from '../document/types';
import { apply, type Operation } from './result';

export type CarcassDimensionField = 'widthMm' | 'heightMm' | 'depthMm';

export const setCarcassDimension: Operation<{ field: CarcassDimensionField; value: number }> = (doc, { field, value }) =>
  apply(doc, (d) => {
    const range = LIMITS[field];
    if (!Number.isFinite(value) || value < range.min || value > range.max) return 'out-of-range';
    d.carcass[field] = value;
  });

export const setBase: Operation<{ base: Base }> = (doc, { base }) =>
  apply(doc, (d) => {
    d.carcass.base = structuredClone(base);
  });

export const setBackFastener: Operation<{ fastener: 'nail' | 'screw' }> = (doc, { fastener }) =>
  apply(doc, (d) => {
    d.carcass.back.fastener = fastener;
  });

export const setMaterialAssignment: Operation<{ group: MaterialGroup; materialId: string }> = (doc, { group, materialId }) =>
  apply(doc, (d) => {
    if (!d.materials.some((m) => m.id === materialId)) return 'unknown-material';
    d.carcass.materialIds[group] = materialId;
  });

export const renameDesign: Operation<{ name: string }> = (doc, { name }) =>
  apply(doc, (d) => {
    const trimmed = name.trim();
    if (trimmed.length < LIMITS.name.min || trimmed.length > LIMITS.name.max) return 'invalid-name';
    d.name = trimmed;
  });
