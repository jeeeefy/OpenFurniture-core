import type { HardwareProfiles } from '../document/types';
import type { ValidationIssue } from '../validate/catalogue';

export type PartRole =
  | 'side-left'
  | 'side-right'
  | 'top'
  | 'bottom'
  | 'divider'
  | 'fixed-shelf'
  | 'adjustable-shelf'
  | 'back'
  | 'plinth-side'
  | 'plinth-front'
  | 'plinth-back'
  | 'door'
  | 'drawer-front'
  | 'drawer-side'
  | 'drawer-inner-front'
  | 'drawer-inner-back'
  | 'drawer-bottom';

export const PART_ROLE_ORDER: readonly PartRole[] = [
  'side-left',
  'side-right',
  'top',
  'bottom',
  'divider',
  'fixed-shelf',
  'adjustable-shelf',
  'back',
  'plinth-side',
  'plinth-front',
  'plinth-back',
  'door',
  'drawer-front',
  'drawer-side',
  'drawer-inner-front',
  'drawer-inner-back',
  'drawer-bottom',
];

export type Axis = 'x' | 'y' | 'z';
export type EdgeId = 'u0' | 'u1' | 'v0' | 'v1';
export type Vec3 = [number, number, number];

export interface Box {
  min: Vec3;
  max: Vec3;
}

export interface Frame {
  u: Axis;
  v: Axis;
  w: Axis;
}

export interface Part {
  id: string;
  role: PartRole;
  /** 'carcass' | 'plinth' | 'back' | columnId | sectionId | drawerId */
  ownerId: string;
  materialId: string;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  box: Box;
  frame: Frame;
  bandedEdges: EdgeId[];
}

export type HolePurpose =
  | 'carcass-screw'
  | 'plinth-screw'
  | 'drawer-box-screw'
  | 'drawer-bottom-screw'
  | 'front-attach'
  | 'back-screw'
  | 'shelf-pin'
  | 'hinge-cup'
  | 'hinge-cup-fixing'
  | 'hinge-plate'
  | 'slide-cabinet'
  | 'slide-drawer'
  | 'handle';

export interface Hole {
  id: string;
  partId: string;
  face: 'A' | 'B';
  uMm: number;
  vMm: number;
  diameterMm: number;
  depthMm: number | 'through';
  countersinkDiameterMm: number | null;
  purpose: HolePurpose;
  profileKey: 'hinge' | 'slide' | 'handle' | 'shelfPin' | null;
  jointId: string | null;
}

export interface Mark {
  id: string;
  partId: string;
  face: 'A' | 'B';
  uMm: number;
  vMm: number;
  purpose: 'rail-support' | 'back-nail' | 'shelf-bracket';
}

export interface Joint {
  id: string;
  kind: 'screw-butt' | 'screw-face';
  facePartId: string;
  otherPartId: string;
  screw: keyof HardwareProfiles;
  count: number;
}

export type HardwareKind =
  | 'screw'
  | 'nail'
  | 'shelf-pin'
  | 'hinge'
  | 'hinge-plate'
  | 'slide'
  | 'handle'
  | 'rail'
  | 'rail-support'
  | 'plinth-bracket'
  | 'edge-band'
  | 'glue'
  | 'wall-anchor';

/** Hardware kinds that get the spare allowance (plan §4.7.10). */
export const SPARE_KINDS: ReadonlySet<HardwareKind> = new Set(['screw', 'nail', 'shelf-pin']);

export interface HardwareItem {
  key: string;
  kind: HardwareKind;
  /** Domain message params for the label, e.g. a screw spec label or a slide length. */
  labelParams: Record<string, string | number>;
  quantity: number;
  unit: 'pcs' | 'pairs' | 'mm';
  /** 'hinge' | 'slide' | 'clothesRail' | 'handle:<id>' for profiles with a verification flag. */
  profileKey: string | null;
  partIds: string[];
}

export interface Envelope {
  widthMm: number;
  heightMm: number;
  depthMm: number;
  depthWithFrontsMm: number;
}

export interface ResolvedSection {
  id: string;
  columnId: string;
  index: number;
  y0: number;
  y1: number;
  heightMm: number;
}

export interface ResolvedColumn {
  id: string;
  index: number;
  x0: number;
  x1: number;
  widthMm: number;
  sections: ResolvedSection[];
}

/** Symbols of plan F.1, resolved from the design's materials. */
export interface Dimensions {
  W: number;
  H: number;
  D: number;
  hP: number;
  t: number;
  tF: number;
  tB: number;
  tFr: number;
  tb: number;
  tbt: number;
  tP: number;
  Hc: number;
  Dc: number;
  Wi: number;
  Hi: number;
}

export interface ResolvedLayout {
  dims: Dimensions;
  columns: ResolvedColumn[];
}

/** Clothes-rail tube (not a panel part): drawn in 3D, listed as hardware. */
export interface RailFitting {
  sectionId: string;
  /** Tube ends (cut length = x1 − x0). */
  x0: number;
  x1: number;
  /** Tube centre. */
  y: number;
  z: number;
  diameterMm: number;
}

export interface FurnitureModel {
  envelope: Envelope;
  layout: ResolvedLayout;
  parts: Part[];
  rails: RailFitting[];
  joints: Joint[];
  holes: Hole[];
  marks: Mark[];
  hardware: HardwareItem[];
  issues: ValidationIssue[];
}

export type DeriveResult =
  | { ok: true; model: FurnitureModel }
  | { ok: false; issues: ValidationIssue[]; envelope: Envelope };
