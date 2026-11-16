export * from './document/types';
export { DESIGN_FILE_FORMAT, designDocumentSchema, designFileEnvelopeSchema } from './document/schema';
export { LIMITS, SCHEMA_VERSION } from './document/limits';
export { decodeDesign, DecodeError, type DecodeErrorCode, type DecodeErrorInit, type DecodeResult } from './document/decode';
export {
  MIGRATIONS,
  migrate,
  MigrationError,
  schemaVersionOf,
  type Migration,
  type Migrations,
} from './document/migrations';
export {
  DEFAULT_HANDLE_ID,
  PRESET_MATERIAL_IDS,
  UNVERIFIED_SOURCE_NOTE,
  presetConstruction,
  presetHardware,
  presetMaterials,
} from './document/defaults';
export { checkReferences } from './document/references';
export { createDesign, TEMPLATE_IDS, type TemplateId } from './templates';
export { TEMPLATE_PLINTH as DEFAULT_PLINTH } from './templates/builders';
export type { IdSource } from './ids';
export type { DomainMessageKey, MessageRef } from './messages';
export { templateNameRef, toolRef } from './messages';
export * from './validate/catalogue';
export * from './operations';
export { deriveModel } from './derive';
export * from './derive/model';
export { distribute, type DistributeResult } from './layout/distribute';
export { INNER_DRAWER_DOOR_SETBACK_MM } from './derive/drawers';
export { behindDoor, coveringSection, frontSpan } from './layout/frontGrid';
export { cutSize } from './derive/frames';
export { generateOutputs, type Outputs } from './outputs';
export { canonicalJson } from './outputs/canonical';
export { computePositions, positionByPartId, type PositionGroup } from './outputs/positions';
export { computeCutList, computeMaterialAreas, type CutListGroup, type CutListRow, type MaterialArea } from './outputs/cutList';
export {
  computeCuttingLayouts,
  DEFAULT_SAW_KERF_MM,
  DEFAULT_SHEET_TRIM_MM,
  type CutSheet,
  type MaterialLayout,
  type SheetPlacement,
} from './outputs/cuttingLayout';
export type { DrillingPlan, EdgeName, FaceSemantic, PlanFace, PlanHole, PlanMark } from './outputs/drillingPlans';
export { edgeNamesFor } from './outputs/drillingPlans';
export { STEP_MESSAGES, type AssemblyPhase, type AssemblyStep, type SafetyKey, type StepMessage } from './outputs/assembly';
export { BASE_TOOLS, type BaseTool, type ToolKey } from './outputs/tools';
export {
  aggregateHardware,
  computeHardwareList,
  HARDWARE_KIND_ORDER,
  type HardwareListRow,
} from './outputs/hardwareList';
export { ceilSafe, EPS, floorSafe, nearlyEqual, roundTo01, type Mm } from './units';
export { isLocale, LOCALES, type Locale } from './locale';
