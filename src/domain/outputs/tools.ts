import type { DesignDocument } from '../document/types';
import type { FurnitureModel } from '../derive/model';
import type { ScrewKey } from '../rules/common';

export const BASE_TOOLS = [
  'tape-measure',
  'square',
  'pencil',
  'clamps',
  'saw',
  'drill-driver',
  'driver-bits',
  'countersink-bit',
  'forstner-35',
  'depth-stop',
  'edge-banding-iron',
  'edge-trimmer',
  'hammer',
  'spirit-level',
  'safety-glasses',
  'hearing-protection',
  'dust-mask',
] as const;

export type BaseTool = (typeof BASE_TOOLS)[number];
export type ToolKey = BaseTool | `drill-bit:${number}`;

const ALWAYS: readonly BaseTool[] = [
  'tape-measure',
  'square',
  'pencil',
  'clamps',
  'saw',
  'drill-driver',
  'driver-bits',
  'safety-glasses',
  'hearing-protection',
  'dust-mask',
];

const SCREW_KEYS: readonly ScrewKey[] = ['carcassScrew', 'plinthScrew', 'drawerBoxScrew', 'drawerBottomScrew', 'frontScrew', 'backScrew'];

export function drillBit(diameterMm: number): ToolKey {
  return `drill-bit:${String(diameterMm)}` as ToolKey;
}

export function drillBitDiameter(tool: ToolKey): number | null {
  return tool.startsWith('drill-bit:') ? Number(tool.slice('drill-bit:'.length)) : null;
}

/** Tools in display order: base tools first, drill bits ascending after the driver bits. */
export function sortTools(tools: Iterable<ToolKey>): ToolKey[] {
  const unique = [...new Set(tools)];
  const rank = (tool: ToolKey) => {
    const d = drillBitDiameter(tool);
    return d === null ? BASE_TOOLS.indexOf(tool as BaseTool) : BASE_TOOLS.indexOf('driver-bits') + 0.5;
  };
  return unique.sort((a, b) => rank(a) - rank(b) || (drillBitDiameter(a) ?? 0) - (drillBitDiameter(b) ?? 0));
}

/** Pilot diameters of the screw specs that the model uses (`screw:<spec>` hardware keys). */
export function usedPilotDiameters(doc: DesignDocument, hardwareKeys: Iterable<string>): number[] {
  const keys = new Set(hardwareKeys);
  return SCREW_KEYS.filter((k) => keys.has(`screw:${k}`)).map((k) => doc.hardware[k].pilotHoleMm);
}

/** Plan §4.7.10 tools list (AC-035). */
export function computeTools(doc: DesignDocument, model: FurnitureModel): ToolKey[] {
  const tools: ToolKey[] = [...ALWAYS];
  const diameters = new Set<number>(model.holes.filter((h) => h.purpose !== 'hinge-cup').map((h) => h.diameterMm));
  for (const d of usedPilotDiameters(doc, model.hardware.map((h) => h.key))) diameters.add(d);
  for (const d of diameters) tools.push(drillBit(d));
  if (model.holes.some((h) => h.countersinkDiameterMm !== null)) tools.push('countersink-bit');
  if (model.holes.some((h) => h.purpose === 'hinge-cup')) tools.push('forstner-35');
  if (model.holes.some((h) => h.depthMm !== 'through')) tools.push('depth-stop');
  if (model.parts.some((p) => p.bandedEdges.length > 0)) tools.push('edge-banding-iron', 'edge-trimmer');
  if (model.parts.some((p) => p.role === 'back') && doc.carcass.back.fastener === 'nail') tools.push('hammer');
  if (model.parts.some((p) => p.role === 'door') || model.issues.some((i) => i.code === 'TALL_FURNITURE_ANCHOR')) {
    tools.push('spirit-level');
  }
  return sortTools(tools);
}
