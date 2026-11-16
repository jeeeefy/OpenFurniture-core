import { z } from 'zod';
import { LIMITS, SCHEMA_VERSION } from './limits';

// The production CSP forbids eval; without this Zod probes `new Function` and triggers a CSP violation report.
z.config({ jitless: true });

type Range = { readonly min: number; readonly max: number };

const num = (range: Range) => z.number().min(range.min).max(range.max);
const int = (range: Range) => z.number().int().min(range.min).max(range.max);

const length = num(LIMITS.length);
const signedOffset = num(LIMITS.signedOffset);
const diameter = num(LIMITS.diameter);
const depth = num(LIMITS.depth);
const factor = num(LIMITS.factor);

const id = z.string().min(LIMITS.id.min).max(LIMITS.id.max);
const name = z
  .string()
  .min(LIMITS.name.min)
  .max(LIMITS.name.max)
  .refine((s) => s.trim().length > 0, { message: 'Name must not be blank' });
const sourceNote = z.string().max(LIMITS.sourceNote.max);
const isoDate = z.string().min(1).max(LIMITS.isoDate.max);

function strictlyAscending(values: readonly number[]): boolean {
  return values.every((v, i) => i === 0 || v > (values[i - 1] ?? Number.NEGATIVE_INFINITY));
}

const ascendingArray = (item: z.ZodNumber, range: Range) =>
  z
    .array(item)
    .min(range.min)
    .max(range.max)
    .refine(strictlyAscending, { message: 'Values must be unique and ascending' });

export const sizeSpecSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('auto') }),
  z.strictObject({ mode: z.literal('fixed'), valueMm: length }),
]);

export const baseSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('none') }),
  z.strictObject({
    kind: z.literal('plinth'),
    heightMm: length,
    setbackFrontMm: length,
    setbackBackMm: length,
    setbackSidesMm: length,
  }),
]);

export const materialGroupSchema = z.enum(['carcass', 'shelves', 'back', 'fronts', 'drawerBox', 'drawerBottom', 'plinth']);

export const carcassSchema = z.strictObject({
  widthMm: num(LIMITS.widthMm),
  heightMm: num(LIMITS.heightMm),
  depthMm: num(LIMITS.depthMm),
  base: baseSchema,
  back: z.strictObject({ fastener: z.enum(['nail', 'screw']) }),
  materialIds: z.strictObject({
    carcass: id,
    shelves: id,
    back: id,
    fronts: id,
    drawerBox: id,
    drawerBottom: id,
    plinth: id,
  }),
});

export const interiorSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('empty') }),
  z.strictObject({
    kind: z.literal('adjustableShelves'),
    count: int(LIMITS.adjustableShelves),
    /** Optional bottom heights above the section floor; absent = even spacing. */
    positionsMm: z.array(length).min(1).max(LIMITS.adjustableShelves.max).optional(),
  }),
  z.strictObject({ kind: z.literal('clothesRail') }),
  z.strictObject({ kind: z.literal('innerDrawers'), count: int(LIMITS.innerDrawers) }),
]);

export const drawerSchema = z.strictObject({ id, frontHeight: sizeSpecSchema });

/** Part-frame edges (plan §4.6): u0/u1 are the ends of the length, v0/v1 the sides. */
export const edgeIdSchema = z.enum(['u0', 'u1', 'v0', 'v1']);
const edgeListSchema = z
  .array(edgeIdSchema)
  .max(4)
  .refine((edges) => new Set(edges).size === edges.length, { message: 'Edges must be unique' });

export const frontSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('none') }),
  z.strictObject({
    kind: z.literal('door'),
    hinge: z.enum(['left', 'right']),
    handleId: id.nullable(),
    spanSections: int(LIMITS.frontSpan).optional(),
  }),
  z.strictObject({ kind: z.literal('doubleDoor'), handleId: id.nullable(), spanSections: int(LIMITS.frontSpan).optional() }),
  z.strictObject({
    kind: z.literal('drawers'),
    drawers: z.array(drawerSchema).min(LIMITS.drawersPerSection.min).max(LIMITS.drawersPerSection.max),
    handleId: id.nullable(),
  }),
]);

export const sectionSchema = z.strictObject({
  id,
  height: sizeSpecSchema,
  interior: interiorSchema,
  front: frontSchema,
});

export const columnSchema = z.strictObject({
  id,
  width: sizeSpecSchema,
  sections: z.array(sectionSchema).min(LIMITS.sectionsPerColumn.min).max(LIMITS.sectionsPerColumn.max),
});

export const materialSchema = z.strictObject({
  id,
  name,
  kind: z.enum(['plywood', 'mdf', 'particleboard', 'melamine', 'hdf', 'other']),
  thicknessMm: num(LIMITS.materialThickness),
  sheet: z.strictObject({ lengthMm: num(LIMITS.sheetSize), widthMm: num(LIMITS.sheetSize) }),
  // Further board sizes for the cutting layout; optional so that older designs stay valid.
  extraSheets: z
    .array(z.strictObject({ lengthMm: num(LIMITS.sheetSize), widthMm: num(LIMITS.sheetSize) }))
    .max(LIMITS.extraSheets.max)
    .optional(),
  hasGrain: z.boolean(),
  edgeBand: z.strictObject({ thicknessMm: length, deductFromCutSize: z.boolean() }).nullable(),
  maxShelfSpanMm: length.nullable(),
});

export const screwSpecSchema = z.strictObject({
  id,
  label: name,
  diameterMm: diameter,
  lengthMm: length,
  clearanceHoleMm: diameter,
  countersinkDiameterMm: diameter,
  pilotHoleMm: diameter,
});

const verifiable = {
  verifiedByUser: z.boolean(),
  sourceNote,
};

const rangeTuple = z
  .tuple([length, length])
  .refine(([min, max]) => min <= max, { message: 'Range minimum must not exceed maximum' });

export const hingeProfileSchema = z.strictObject({
  id,
  name,
  ...verifiable,
  cupDiameterMm: diameter,
  cupDepthMm: depth,
  cupEdgeDistanceMm: length,
  cupFixingHoles: z
    .array(
      z.strictObject({
        offsetAlongMm: signedOffset,
        offsetInwardMm: signedOffset,
        diameterMm: diameter,
        depthMm: depth,
      }),
    )
    .min(LIMITS.cupFixingHoles.min)
    .max(LIMITS.cupFixingHoles.max),
  plate: z.strictObject({
    setbackFromFrontMm: length,
    holeOffsetsAlongMm: ascendingArray(signedOffset, LIMITS.plateHoleOffsets),
    holeDiameterMm: diameter,
    holeDepthMm: depth,
  }),
  overlayRangesMm: z.strictObject({ full: rangeTuple, half: rangeTuple }),
  edgeOffsetMm: length,
  countByHeight: z
    .array(z.strictObject({ maxDoorHeightMm: length, count: int(LIMITS.hingeCount) }))
    .min(LIMITS.countByHeight.min)
    .max(LIMITS.countByHeight.max)
    .refine((rows) => strictlyAscending(rows.map((r) => r.maxDoorHeightMm)), {
      message: 'Door heights must be unique and ascending',
    }),
  maxDoorWidthMm: length,
  screwLabel: name,
  cupScrewsPerHinge: int(LIMITS.cupScrewsPerHinge),
});

export const slideProfileSchema = z.strictObject({
  id,
  name,
  ...verifiable,
  sideClearanceMm: length,
  lengthsMm: ascendingArray(num(LIMITS.slideLength), LIMITS.slideLengths),
  rearClearanceMm: length,
  frontSetbackMm: length,
  heightMm: length,
  cabinetHoleOffsetsMm: ascendingArray(length, LIMITS.slideHoleOffsets),
  drawerHoleOffsetsMm: ascendingArray(length, LIMITS.slideHoleOffsets),
  holeDiameterMm: diameter,
  holeDepthMm: depth,
  screwLabel: name,
});

export const shelfPinProfileSchema = z.strictObject({
  id,
  name,
  holeDiameterMm: diameter,
  holeDepthMm: depth,
  rowSetbackMm: length,
  pitchMm: num({ min: 1, max: LIMITS.length.max }),
  marginMm: length,
  pinsPerShelf: int(LIMITS.pinsPerShelf),
  shelfSideClearanceMm: length,
  shelfRearClearanceMm: length,
  shelfFrontSetbackOpenMm: length,
  shelfFrontSetbackDoorMm: length,
});

export const handleProfileSchema = z
  .strictObject({
    id,
    name,
    ...verifiable,
    kind: z.enum(['knob', 'bar']),
    centerDistanceMm: length.nullable(),
    holeDiameterMm: diameter,
    screwLengthsMm: ascendingArray(num(LIMITS.handleScrewLength), LIMITS.handleScrewLengths),
    screwEngagementMm: length,
  })
  .refine((h) => (h.kind === 'bar') === (h.centerDistanceMm !== null), {
    message: 'Bars need a centre distance; knobs must not have one',
    path: ['centerDistanceMm'],
  });

export const clothesRailProfileSchema = z.strictObject({
  id,
  name,
  ...verifiable,
  tubeDiameterMm: diameter,
  centerBelowTopMm: length,
  endAllowanceMm: length,
  screwsPerSupport: int(LIMITS.screwsPerSupport),
  screwLabel: name,
});

export const plinthBracketSchema = z.strictObject({
  label: name,
  screwLabel: name,
  screwLengthMm: length,
  screwsPerBracket: int(LIMITS.screwsPerBracket),
  maxSpacingMm: num({ min: 1, max: LIMITS.length.max }),
});

export const hardwareProfilesSchema = z.strictObject({
  carcassScrew: screwSpecSchema,
  plinthScrew: screwSpecSchema,
  drawerBoxScrew: screwSpecSchema,
  drawerBottomScrew: screwSpecSchema,
  frontScrew: screwSpecSchema,
  backScrew: screwSpecSchema,
  backNailLabel: name,
  backFastenerSpacingMm: num({ min: 1, max: LIMITS.length.max }),
  backFastenerEndOffsetMm: length,
  plinthBracket: plinthBracketSchema,
  hinge: hingeProfileSchema,
  slide: slideProfileSchema,
  shelfPin: shelfPinProfileSchema,
  handles: z.array(handleProfileSchema).min(LIMITS.handles.min).max(LIMITS.handles.max),
  clothesRail: clothesRailProfileSchema,
});

export const constructionSettingsSchema = z.strictObject({
  frontRevealMm: length,
  frontGapMm: length,
  drawerBoxClearanceBelowMm: length,
  drawerBoxClearanceAboveMm: length,
  screwEdgeDistanceMm: length,
  screwMaxSpacingMm: num({ min: 1, max: LIMITS.length.max }),
  minFixedShelfOffsetAcrossDividerMm: length,
  toolClearanceMm: length,
  toolBodyClearanceMm: length,
  minHoleEdgeMaterialMm: length,
  minHoleSpacingMm: length,
  minRemainingMaterialMm: length,
  tallFurnitureHeightMm: length,
  spareFactor: factor,
  edgeBandWasteFactor: factor,
  minColumnClearWidthMm: length,
  minSectionClearHeightMm: length,
  minDrawerBoxHeightMm: length,
  minDoorWidthMm: length,
  // Optional so that designs saved before the cutting layout stay valid (defaults in outputs/cuttingLayout.ts).
  sawKerfMm: num(LIMITS.sawKerf).optional(),
  sheetTrimMm: num(LIMITS.sheetTrim).optional(),
});

export const designDocumentSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id,
  name,
  createdAt: isoDate,
  updatedAt: isoDate,
  carcass: carcassSchema,
  layout: z.strictObject({
    columns: z.array(columnSchema).min(LIMITS.columns.min).max(LIMITS.columns.max),
  }),
  materials: z.array(materialSchema).min(LIMITS.materials.min).max(LIMITS.materials.max),
  hardware: hardwareProfilesSchema,
  construction: constructionSettingsSchema,
  // Optional so files saved before per-edge overrides stay valid. Keys are derived part ids; stale keys are ignored.
  bandingOverrides: z.record(id, edgeListSchema).optional(),
});

export const DESIGN_FILE_FORMAT = 'furniture-designer/design';

/** Export envelope (plan §5.2): exactly these four keys; the design is validated separately after migration. */
export const designFileEnvelopeSchema = z.strictObject({
  format: z.string().max(100),
  appVersion: z.string().max(40),
  exportedAt: z.string().max(40),
  design: z.looseObject({}),
});
