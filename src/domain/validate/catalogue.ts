export const ERROR_CODES = [
  'REFERENCE_INVALID',
  'DIMENSION_OUT_OF_RANGE',
  'BACK_THICKNESS_OUT_OF_RANGE',
  'PLINTH_DIMENSION_INVALID',
  'LAYOUT_COLUMNS_DONT_FIT',
  'LAYOUT_SECTIONS_DONT_FIT',
  'COLUMN_TOO_NARROW',
  'SECTION_TOO_LOW',
  'PART_EXCEEDS_SHEET',
  'DOOR_TOO_SHORT_FOR_HINGES',
  'DOOR_TOO_TALL',
  'DOOR_TOO_NARROW',
  'FRONT_SPAN_INVALID',
  'HINGE_OVERLAY_UNSUPPORTED',
  'DRAWER_INTERIOR_CONFLICT',
  'DRAWER_FRONTS_DONT_FIT',
  'DRAWER_DEPTH_NO_SLIDE',
  'DRAWER_BOX_TOO_LOW',
  'DRAWER_BOX_TOO_NARROW',
  'SCREW_TOO_LONG',
  'HANDLE_DOES_NOT_FIT',
  'HOLE_TOO_CLOSE_TO_EDGE',
  'HOLE_CONFLICT',
  'TOO_MANY_PARTS',
] as const;

export const WARNING_CODES = [
  'HARDWARE_PROFILE_UNVERIFIED',
  'TALL_FURNITURE_ANCHOR',
  'SHELF_SPAN_HEURISTIC',
  'DOOR_WIDE',
  'RAIL_SHALLOW_DEPTH',
  'RAIL_SPAN_LONG',
  'RAIL_SECTION_LOW',
  'NARROW_COMPARTMENT_TOOL_ACCESS',
  'TOOL_ACCESS_TIGHT',
  'HANDLE_SCREW_LENGTH_UNAVAILABLE',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
export type WarningCode = (typeof WARNING_CODES)[number];
export type IssueCode = ErrorCode | WarningCode;
export type Severity = 'error' | 'warning';

export type IssueTargetKind =
  | 'design'
  | 'carcass'
  | 'column'
  | 'section'
  | 'drawer'
  | 'material'
  | 'profile'
  | 'construction'
  | 'part';

export interface IssueTarget {
  kind: IssueTargetKind;
  id: string;
  field?: string;
}

export interface ValidationIssue {
  code: IssueCode;
  severity: Severity;
  target: IssueTarget;
  params: Record<string, string | number>;
}

const errorSet: ReadonlySet<string> = new Set(ERROR_CODES);

export function severityOf(code: IssueCode): Severity {
  return errorSet.has(code) ? 'error' : 'warning';
}

export function issue(code: IssueCode, target: IssueTarget, params: Record<string, string | number> = {}): ValidationIssue {
  return { code, severity: severityOf(code), target, params };
}

/** Errors first, then by code, then by target id (plan F.9). */
export function sortIssues(issues: readonly ValidationIssue[]): ValidationIssue[] {
  return [...issues].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1;
    if (a.code !== b.code) return a.code < b.code ? -1 : 1;
    if (a.target.id !== b.target.id) return a.target.id < b.target.id ? -1 : 1;
    const fa = a.target.field ?? '';
    const fb = b.target.field ?? '';
    if (fa !== fb) return fa < fb ? -1 : 1;
    return 0;
  });
}

export function hasErrors(issues: readonly ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}
