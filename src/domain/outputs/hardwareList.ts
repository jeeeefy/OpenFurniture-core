import type { DesignDocument } from '../document/types';
import { SPARE_KINDS, type FurnitureModel, type HardwareItem, type HardwareKind } from '../derive/model';
import type { MessageRef } from '../messages';
import { ceilSafe } from '../units';
import { bandedLengthByMaterial } from './cutList';
import { positionByPartId, type PositionGroup } from './positions';

export interface HardwareListRow {
  key: string;
  kind: HardwareKind;
  quantity: number;
  unit: 'pcs' | 'pairs' | 'm' | 'mm';
  spareIncluded: number;
  label: MessageRef;
  profileKey: string | null;
  verified: boolean | null;
  /** Position numbers of the parts the item is used on (plan §6.4 "where used"). */
  positions: number[];
}

export const HARDWARE_KIND_ORDER: readonly HardwareKind[] = [
  'screw',
  'nail',
  'shelf-pin',
  'hinge',
  'hinge-plate',
  'slide',
  'handle',
  'rail',
  'rail-support',
  'plinth-bracket',
  'edge-band',
  'glue',
  'wall-anchor',
];

const KIND_RANK = new Map(HARDWARE_KIND_ORDER.map((kind, i) => [kind, i]));

export function profileVerified(doc: DesignDocument, profileKey: string | null): boolean | null {
  if (profileKey === null) return null;
  if (profileKey === 'hinge') return doc.hardware.hinge.verifiedByUser;
  if (profileKey === 'slide') return doc.hardware.slide.verifiedByUser;
  if (profileKey === 'clothesRail') return doc.hardware.clothesRail.verifiedByUser;
  if (profileKey.startsWith('handle:')) {
    const id = profileKey.slice('handle:'.length);
    return doc.hardware.handles.find((h) => h.id === id)?.verifiedByUser ?? null;
  }
  return null;
}

/** Sums items by key; screws, nails and shelf pins get the spare allowance after summing (AC-029). */
export function aggregateHardware(
  doc: DesignDocument,
  items: readonly HardwareItem[],
  positionOf: ReadonlyMap<string, number> = new Map(),
): HardwareListRow[] {
  const byKey = new Map<string, HardwareItem>();
  for (const item of items) {
    const existing = byKey.get(item.key);
    if (existing) {
      existing.quantity += item.quantity;
      existing.partIds.push(...item.partIds);
    } else byKey.set(item.key, { ...item, partIds: [...item.partIds] });
  }
  const spareFactor = doc.construction.spareFactor;
  return [...byKey.values()].map((item) => {
    const quantity = SPARE_KINDS.has(item.kind) ? ceilSafe(item.quantity * (1 + spareFactor)) : item.quantity;
    return {
      key: item.key,
      kind: item.kind,
      quantity,
      unit: item.unit,
      spareIncluded: quantity - item.quantity,
      label: { key: `hardware.${item.kind}`, params: item.labelParams },
      profileKey: item.profileKey,
      verified: profileVerified(doc, item.profileKey),
      positions: [...new Set(item.partIds.flatMap((id) => positionOf.get(id) ?? []))].sort((a, b) => a - b),
    };
  });
}

/** Edge banding in m per material: Σ banded lengths × (1 + waste), rounded up to 0.1 m. */
function edgeBandRows(doc: DesignDocument, positions: readonly PositionGroup[]): HardwareListRow[] {
  const totals = bandedLengthByMaterial(positions);
  return doc.materials.flatMap((material) => {
    const mm = totals.get(material.id);
    if (mm === undefined || material.edgeBand === null) return [];
    const metres = ceilSafe((mm / 1000) * (1 + doc.construction.edgeBandWasteFactor) * 10) / 10;
    return [
      {
        key: `edge-band:${material.id}`,
        kind: 'edge-band' as const,
        quantity: metres,
        unit: 'm' as const,
        spareIncluded: 0,
        label: { key: 'hardware.edge-band' as const, params: { material: material.name, thicknessMm: material.edgeBand.thicknessMm } },
        profileKey: null,
        verified: null,
        positions: positions.filter((p) => p.materialId === material.id && p.bandedEdges.length > 0).map((p) => p.position),
      },
    ];
  });
}

export function computeHardwareList(
  doc: DesignDocument,
  model: FurnitureModel,
  positions: readonly PositionGroup[],
): HardwareListRow[] {
  const rows = [...aggregateHardware(doc, model.hardware, positionByPartId(positions)), ...edgeBandRows(doc, positions)];
  const gluedJoints = model.joints.filter((j) => j.kind === 'screw-butt').length;
  if (gluedJoints > 0) {
    rows.push({
      key: 'glue',
      kind: 'glue',
      quantity: gluedJoints,
      unit: 'pcs',
      spareIncluded: 0,
      label: { key: 'hardware.glue', params: { joints: gluedJoints } },
      profileKey: null,
      verified: null,
      positions: [],
    });
  }
  if (model.issues.some((i) => i.code === 'TALL_FURNITURE_ANCHOR')) {
    rows.push({
      key: 'wall-anchor',
      kind: 'wall-anchor',
      quantity: 1,
      unit: 'pcs',
      spareIncluded: 0,
      label: { key: 'hardware.wall-anchor' },
      profileKey: null,
      verified: null,
      positions: [],
    });
  }
  return rows.sort((a, b) => {
    const rank = (KIND_RANK.get(a.kind) ?? 0) - (KIND_RANK.get(b.kind) ?? 0);
    if (rank !== 0) return rank;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
}
