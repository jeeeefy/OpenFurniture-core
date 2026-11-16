import { LIMITS } from '../document/limits';
import type { ConstructionSettings, DesignDocument, HardwareProfiles, Material } from '../document/types';
import type { EdgeId } from '../derive/model';
import { apply, type Operation, type OpResult } from './result';

export const addMaterial: Operation<{ material: Material }> = (doc, { material }) =>
  apply(doc, (d) => {
    if (d.materials.length >= LIMITS.materials.max) return 'max-materials';
    d.materials.push(structuredClone(material));
  });

/** Replaces the material with the same id. */
export const updateMaterial: Operation<{ material: Material }> = (doc, { material }) =>
  apply(doc, (d) => {
    const index = d.materials.findIndex((m) => m.id === material.id);
    if (index < 0) return 'not-found';
    d.materials[index] = structuredClone(material);
  });

export const removeMaterial: Operation<{ materialId: string }> = (doc, { materialId }) =>
  apply(doc, (d) => {
    const index = d.materials.findIndex((m) => m.id === materialId);
    if (index < 0) return 'not-found';
    if (Object.values(d.carcass.materialIds).includes(materialId)) return 'material-in-use';
    d.materials.splice(index, 1);
  });

export function updateHardwareProfile<K extends keyof HardwareProfiles>(
  doc: DesignDocument,
  { key, value }: { key: K; value: HardwareProfiles[K] },
): OpResult {
  return apply(doc, (d) => {
    d.hardware[key] = structuredClone(value);
  });
}

export const updateConstruction: Operation<{ patch: Partial<ConstructionSettings> }> = (doc, { patch }) =>
  apply(doc, (d) => {
    d.construction = { ...d.construction, ...structuredClone(patch) };
  });

/** Applies the same edge set to every part in a position (L-13). */
export const setBandingEdges: Operation<{ partIds: readonly string[]; edges: readonly EdgeId[] }> = (doc, { partIds, edges }) =>
  apply(doc, (d) => {
    if (partIds.length === 0) return 'not-found';
    const next = [...new Set(edges)].sort();
    d.bandingOverrides ??= {};
    for (const partId of partIds) d.bandingOverrides[partId] = next;
  });

/** Drops every override so the role defaults apply again. */
export const resetBandingOverrides: Operation<Record<string, never>> = (doc) =>
  apply(doc, (d) => {
    delete d.bandingOverrides;
  });
