import { presetConstruction, presetHardware, presetMaterials, PRESET_MATERIAL_IDS } from '../document/defaults';
import { SCHEMA_VERSION } from '../document/limits';
import type { Base, Carcass, Column, DesignDocument, Front, Interior, Section, SizeSpec } from '../document/types';
import type { IdSource } from '../ids';

export const AUTO: SizeSpec = { mode: 'auto' };

export const fixed = (valueMm: number): SizeSpec => ({ mode: 'fixed', valueMm });

/** Plinth used by all templates with a base (plan §4.9). */
export const TEMPLATE_PLINTH: Base = {
  kind: 'plinth',
  heightMm: 100,
  setbackFrontMm: 50,
  setbackBackMm: 0,
  setbackSidesMm: 0,
};

export function templateCarcass(widthMm: number, heightMm: number, depthMm: number, base: Base): Carcass {
  return {
    widthMm,
    heightMm,
    depthMm,
    base,
    back: { fastener: 'nail' },
    materialIds: {
      carcass: PRESET_MATERIAL_IDS.ply18,
      shelves: PRESET_MATERIAL_IDS.ply18,
      back: PRESET_MATERIAL_IDS.hdf3,
      fronts: PRESET_MATERIAL_IDS.ply18,
      drawerBox: PRESET_MATERIAL_IDS.ply15,
      drawerBottom: PRESET_MATERIAL_IDS.ply9,
      plinth: PRESET_MATERIAL_IDS.ply18,
    },
  };
}

export interface SectionSpec {
  height?: SizeSpec;
  interior?: Interior;
  front?: Front;
}

export function makeSection(newId: IdSource, spec: SectionSpec = {}): Section {
  return {
    id: newId(),
    height: spec.height ?? AUTO,
    interior: spec.interior ?? { kind: 'empty' },
    front: spec.front ?? { kind: 'none' },
  };
}

/** Sections are created bottom → top in the order given; ids are drawn in that order. */
export function makeColumn(newId: IdSource, sections: SectionSpec[], width: SizeSpec = AUTO): Column {
  const id = newId();
  return { id, width, sections: sections.map((s) => makeSection(newId, s)) };
}

export function makeDocument(
  newId: IdSource,
  nowIso: string,
  name: string,
  carcass: Carcass,
  buildColumns: () => Column[],
): DesignDocument {
  const id = newId();
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    name,
    createdAt: nowIso,
    updatedAt: nowIso,
    carcass,
    layout: { columns: buildColumns() },
    materials: presetMaterials(),
    hardware: presetHardware(),
    construction: presetConstruction(),
  };
}
