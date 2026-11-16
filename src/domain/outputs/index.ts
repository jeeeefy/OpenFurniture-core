import type { DesignDocument } from '../document/types';
import type { FurnitureModel } from '../derive/model';
import { computeAssembly, type AssemblyStep } from './assembly';
import { computeCuttingLayouts, type MaterialLayout } from './cuttingLayout';
import { computeCutList, type CutListGroup } from './cutList';
import { computeDrillingPlans, type DrillingPlan } from './drillingPlans';
import { computeHardwareList, type HardwareListRow } from './hardwareList';
import { computePositions, type PositionGroup } from './positions';
import { computeTools, type ToolKey } from './tools';

export interface Outputs {
  positions: PositionGroup[];
  cutList: CutListGroup[];
  cuttingLayouts: MaterialLayout[];
  hardware: HardwareListRow[];
  drillingPlans: DrillingPlan[];
  steps: AssemblyStep[];
  tools: ToolKey[];
}

/** Only called when `model.issues` contains no errors. */
export function generateOutputs(doc: DesignDocument, model: FurnitureModel): Outputs {
  const positions = computePositions(doc, model);
  const hardware = computeHardwareList(doc, model, positions);
  const cutList = computeCutList(doc, positions);
  return {
    positions,
    cutList,
    cuttingLayouts: computeCuttingLayouts(doc, cutList),
    hardware,
    drillingPlans: computeDrillingPlans(doc, model, positions),
    steps: computeAssembly(doc, model, hardware),
    tools: computeTools(doc, model),
  };
}
