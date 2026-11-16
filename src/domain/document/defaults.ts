import type {
  ConstructionSettings,
  HandleProfile,
  HardwareProfiles,
  Material,
  ScrewSpec,
} from './types';

/** Preset values are TYPICAL workshop values; every design gets its own copy (plan §4.3). */

export const UNVERIFIED_SOURCE_NOTE = "Generic default – verify against your product's datasheet";

export const PRESET_MATERIAL_IDS = {
  ply18: 'mat-ply-18',
  ply15: 'mat-ply-15',
  ply9: 'mat-ply-9',
  ply6: 'mat-ply-6',
  mel19: 'mat-mel-19',
  mdf19: 'mat-mdf-19',
  hdf3: 'mat-hdf-3',
} as const;

export const DEFAULT_HANDLE_ID = 'h-bar-128';

const plywoodSheet = { lengthMm: 2500, widthMm: 1250 };
const boardSheet = { lengthMm: 2800, widthMm: 2070 };

export function presetMaterials(): Material[] {
  return [
    {
      id: PRESET_MATERIAL_IDS.ply18,
      name: 'Birch plywood 18 mm',
      kind: 'plywood',
      thicknessMm: 18,
      sheet: { ...plywoodSheet },
      hasGrain: true,
      edgeBand: { thicknessMm: 0.5, deductFromCutSize: false },
      maxShelfSpanMm: 800,
    },
    {
      id: PRESET_MATERIAL_IDS.ply15,
      name: 'Birch plywood 15 mm',
      kind: 'plywood',
      thicknessMm: 15,
      sheet: { ...plywoodSheet },
      hasGrain: true,
      edgeBand: { thicknessMm: 0.5, deductFromCutSize: false },
      maxShelfSpanMm: 700,
    },
    {
      id: PRESET_MATERIAL_IDS.ply9,
      name: 'Birch plywood 9 mm',
      kind: 'plywood',
      thicknessMm: 9,
      sheet: { ...plywoodSheet },
      hasGrain: true,
      edgeBand: null,
      maxShelfSpanMm: null,
    },
    {
      id: PRESET_MATERIAL_IDS.ply6,
      name: 'Birch plywood 6 mm',
      kind: 'plywood',
      thicknessMm: 6,
      sheet: { ...plywoodSheet },
      hasGrain: true,
      edgeBand: null,
      maxShelfSpanMm: null,
    },
    {
      id: PRESET_MATERIAL_IDS.mel19,
      name: 'White melamine chipboard 19 mm',
      kind: 'melamine',
      thicknessMm: 19,
      sheet: { ...boardSheet },
      hasGrain: false,
      edgeBand: { thicknessMm: 1, deductFromCutSize: true },
      maxShelfSpanMm: 600,
    },
    {
      id: PRESET_MATERIAL_IDS.mdf19,
      name: 'MDF 19 mm',
      kind: 'mdf',
      thicknessMm: 19,
      sheet: { ...boardSheet },
      hasGrain: false,
      edgeBand: null,
      maxShelfSpanMm: 650,
    },
    {
      id: PRESET_MATERIAL_IDS.hdf3,
      name: 'HDF 3 mm',
      kind: 'hdf',
      thicknessMm: 3,
      sheet: { ...boardSheet },
      hasGrain: false,
      edgeBand: null,
      maxShelfSpanMm: null,
    },
  ];
}

function screw(
  id: string,
  label: string,
  diameterMm: number,
  lengthMm: number,
  clearanceHoleMm: number,
  countersinkDiameterMm: number,
  pilotHoleMm: number,
): ScrewSpec {
  return { id, label, diameterMm, lengthMm, clearanceHoleMm, countersinkDiameterMm, pilotHoleMm };
}

const HANDLE_SCREW_LENGTHS = [22, 25, 30, 35, 40, 45];

function handle(id: string, name: string, kind: HandleProfile['kind'], centerDistanceMm: number | null): HandleProfile {
  return {
    id,
    name,
    verifiedByUser: false,
    sourceNote: UNVERIFIED_SOURCE_NOTE,
    kind,
    centerDistanceMm,
    holeDiameterMm: 5,
    screwLengthsMm: [...HANDLE_SCREW_LENGTHS],
    screwEngagementMm: 8,
  };
}

const SLIDE_HOLE_OFFSETS = [37, 165, 293, 421, 549];
const CHIPBOARD_SCREW_LABEL = '3.5 × 16 chipboard screw';

export function presetHardware(): HardwareProfiles {
  return {
    carcassScrew: screw('screw-carcass', 'Countersunk wood screw 4.0 × 50', 4, 50, 4.5, 8.5, 2.5),
    plinthScrew: screw('screw-plinth', 'Countersunk wood screw 4.0 × 40', 4, 40, 4.5, 8.5, 2.5),
    drawerBoxScrew: screw('screw-drawer-box', 'Countersunk wood screw 3.5 × 40', 3.5, 40, 4, 7.5, 2),
    drawerBottomScrew: screw('screw-drawer-bottom', 'Countersunk wood screw 3.5 × 25', 3.5, 25, 4, 7.5, 2),
    frontScrew: screw('screw-front', 'Countersunk wood screw 3.5 × 25', 3.5, 25, 4, 7.5, 2),
    backScrew: screw('screw-back', 'Countersunk screw 3.0 × 16', 3, 16, 3.5, 6.5, 2),
    backNailLabel: 'Panel pin 1.6 × 25',
    backFastenerSpacingMm: 100,
    backFastenerEndOffsetMm: 30,
    plinthBracket: {
      label: 'Steel angle bracket 40 × 40',
      screwLabel: 'Countersunk screw 3.5 × 16',
      screwLengthMm: 16,
      screwsPerBracket: 4,
      maxSpacingMm: 400,
    },
    hinge: {
      id: 'hinge-generic-35',
      name: 'Concealed cup hinge 35 mm (generic)',
      verifiedByUser: false,
      sourceNote: UNVERIFIED_SOURCE_NOTE,
      cupDiameterMm: 35,
      cupDepthMm: 13,
      cupEdgeDistanceMm: 4,
      cupFixingHoles: [],
      plate: { setbackFromFrontMm: 37, holeOffsetsAlongMm: [-16, 16], holeDiameterMm: 2.5, holeDepthMm: 10 },
      overlayRangesMm: { full: [14, 18], half: [5, 10] },
      edgeOffsetMm: 100,
      countByHeight: [
        { maxDoorHeightMm: 900, count: 2 },
        { maxDoorHeightMm: 1600, count: 3 },
        { maxDoorHeightMm: 2000, count: 4 },
        { maxDoorHeightMm: 2400, count: 5 },
      ],
      maxDoorWidthMm: 600,
      screwLabel: CHIPBOARD_SCREW_LABEL,
      cupScrewsPerHinge: 2,
    },
    slide: {
      id: 'slide-generic-ball-bearing',
      name: 'Ball-bearing side-mount slide (generic)',
      verifiedByUser: false,
      sourceNote: UNVERIFIED_SOURCE_NOTE,
      sideClearanceMm: 12.7,
      lengthsMm: [250, 300, 350, 400, 450, 500, 550],
      rearClearanceMm: 10,
      frontSetbackMm: 2,
      heightMm: 45,
      cabinetHoleOffsetsMm: [...SLIDE_HOLE_OFFSETS],
      drawerHoleOffsetsMm: [...SLIDE_HOLE_OFFSETS],
      holeDiameterMm: 2.5,
      holeDepthMm: 10,
      screwLabel: CHIPBOARD_SCREW_LABEL,
    },
    shelfPin: {
      id: 'shelf-pin-5',
      name: 'Shelf pin 5 mm',
      holeDiameterMm: 5,
      holeDepthMm: 10,
      rowSetbackMm: 37,
      pitchMm: 32,
      marginMm: 40,
      pinsPerShelf: 4,
      shelfSideClearanceMm: 1,
      shelfRearClearanceMm: 2,
      shelfFrontSetbackOpenMm: 2,
      shelfFrontSetbackDoorMm: 20,
    },
    handles: [
      handle(DEFAULT_HANDLE_ID, 'Bar handle 128 mm', 'bar', 128),
      handle('h-bar-96', 'Bar handle 96 mm', 'bar', 96),
      handle('h-knob', 'Knob', 'knob', null),
    ],
    clothesRail: {
      id: 'rail-generic-25',
      name: 'Clothes rail Ø25 (generic)',
      verifiedByUser: false,
      sourceNote: UNVERIFIED_SOURCE_NOTE,
      tubeDiameterMm: 25,
      centerBelowTopMm: 60,
      endAllowanceMm: 2,
      screwsPerSupport: 2,
      screwLabel: CHIPBOARD_SCREW_LABEL,
    },
  };
}

export function presetConstruction(): ConstructionSettings {
  return {
    frontRevealMm: 2,
    frontGapMm: 3,
    drawerBoxClearanceBelowMm: 10,
    drawerBoxClearanceAboveMm: 20,
    screwEdgeDistanceMm: 40,
    screwMaxSpacingMm: 150,
    minFixedShelfOffsetAcrossDividerMm: 50,
    sawKerfMm: 3,
    sheetTrimMm: 5,
    toolClearanceMm: 35,
    toolBodyClearanceMm: 150,
    minHoleEdgeMaterialMm: 2,
    minHoleSpacingMm: 3,
    minRemainingMaterialMm: 3,
    tallFurnitureHeightMm: 750,
    spareFactor: 0.1,
    edgeBandWasteFactor: 0.1,
    minColumnClearWidthMm: 100,
    minSectionClearHeightMm: 50,
    minDrawerBoxHeightMm: 60,
    minDoorWidthMm: 150,
  };
}
