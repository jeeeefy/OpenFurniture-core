import type { HardwareKind } from './derive/model';
import type { OpRejection } from './operations/result';
import type { SafetyKey, StepMessage } from './outputs/assembly';
import { drillBitDiameter, type BaseTool, type ToolKey } from './outputs/tools';
import type { TemplateId } from './templates';
import type { IssueCode } from './validate/catalogue';

/** Message keys the domain emits; `src/i18n` must provide every one of them in EN and DE. */
export type DomainMessageKey =
  | `template.${TemplateId}`
  | `op.${OpRejection}`
  | `hardware.${HardwareKind}`
  | `issue.${IssueCode}`
  | `step.${StepMessage}`
  | `tool.${BaseTool}`
  | 'tool.drill-bit'
  | `safety.${SafetyKey}`;

export interface MessageRef {
  key: DomainMessageKey;
  params?: Record<string, string | number>;
}

export function templateNameRef(template: TemplateId): MessageRef {
  return { key: `template.${template}` };
}

export function toolRef(tool: ToolKey): MessageRef {
  const d = drillBitDiameter(tool);
  return d === null ? { key: `tool.${tool as BaseTool}` } : { key: 'tool.drill-bit', params: { diameterMm: d } };
}
