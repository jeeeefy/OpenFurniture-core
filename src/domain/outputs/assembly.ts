import type { DesignDocument } from '../document/types';
import type { FurnitureModel, Part } from '../derive/model';
import type { MessageRef } from '../messages';
import type { HardwareListRow } from './hardwareList';
import { drillBit, sortTools, usedPilotDiameters, type ToolKey } from './tools';

export type AssemblyPhase = 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7' | 'P8' | 'P9' | 'P10' | 'P11' | 'P12';
export type SafetyKey = 'sawing' | 'drilling' | 'lifting' | 'wall-anchoring';

export const STEP_MESSAGES = [
  'cut.title',
  'cut.body',
  'cut.edgeBand',
  'drill.title',
  'drill.body',
  'drill.depthStop',
  'drill.unverified',
  'premount.title',
  'premount.hingePlates',
  'premount.slides',
  'pilot.body',
  'divider.title',
  'divider.body',
  'joinLoose.title',
  'joinAssembly.title',
  'join.body',
  'join.brackets',
  'toolAccess.body',
  'topBottom.title',
  'topBottom.body',
  'sideLeft.title',
  'sideLeft.body',
  'sideRight.title',
  'sideRight.body',
  'back.title',
  'back.square',
  'back.nails',
  'back.screws',
  'plinth.title',
  'plinth.body',
  'standUp.title',
  'standUp.body',
  'standUp.twoPeople',
  'interior.title',
  'interior.shelves',
  'interior.rail',
  'doors.title',
  'doors.body',
  'drawers.title',
  'drawers.boxes',
  'drawers.slides',
  'drawers.fronts',
  'drawers.handleHoles',
  'handles.title',
  'handles.body',
  'finish.title',
  'finish.anchor',
  'finish.check',
] as const;
export type StepMessage = (typeof STEP_MESSAGES)[number];

export interface AssemblyStep {
  index: number;
  phase: AssemblyPhase;
  title: MessageRef;
  body: MessageRef[];
  newPartIds: string[];
  visiblePartIds: string[];
  highlightPartIds: string[];
  hardware: { key: string; quantity: number }[];
  tools: ToolKey[];
  orientation: 'upright' | 'on-back' | 'flat';
  camera: 'iso-front' | 'iso-back' | 'front';
  safety: MessageRef[];
}

interface Draft {
  phase: AssemblyPhase;
  title: MessageRef;
  body: MessageRef[];
  newPartIds: string[];
  /** P0 shows the finished piece. */
  showAll: boolean;
  highlight: string[] | null;
  hardware: Map<string, number>;
  tools: ToolKey[];
  orientation: AssemblyStep['orientation'];
  camera: AssemblyStep['camera'];
  safety: SafetyKey[];
}

const msg = (key: StepMessage, params?: Record<string, string | number>): MessageRef =>
  params ? { key: `step.${key}`, params } : { key: `step.${key}` };

const CARCASS_ROLES = new Set<Part['role']>(['side-left', 'side-right', 'top', 'bottom', 'divider', 'fixed-shelf']);
const SQUARE_TOLERANCE_MM = 2;
const JOIN_TOOLS: ToolKey[] = ['clamps', 'square', 'drill-driver', 'driver-bits'];

/** Plan §4.7.11: steps phase by phase; a step is emitted only when it has content. */
export function computeAssembly(doc: DesignDocument, model: FurnitureModel, hardwareRows: readonly HardwareListRow[]): AssemblyStep[] {
  const drafts: Draft[] = [];
  const stepOf = new Map<string, number>();
  const pairStep = new Map<string, number>();
  const parts = model.parts;
  const byId = new Map(parts.map((p) => [p.id, p]));
  const columns = model.layout.columns;
  const tall = model.issues.some((i) => i.code === 'TALL_FURNITURE_ANCHOR');


  const add = (d: Omit<Draft, 'hardware' | 'showAll' | 'highlight'> & Partial<Pick<Draft, 'showAll' | 'highlight'>>): number => {
    const index = drafts.length;
    drafts.push({ showAll: false, highlight: null, ...d, hardware: new Map() });
    for (const id of d.newPartIds) stepOf.set(id, index);
    return index;
  };
  const notNew = (ids: readonly string[]) => ids.filter((id) => byId.has(id) && !stepOf.has(id));
  const dividerId = (k: number) => `divider:${columns[k - 1]?.id ?? ''}`;
  const shelvesOf = (c: number) =>
    (columns[c - 1]?.sections ?? []).map((s) => `fixed:${s.id}`).filter((id) => byId.has(id));

  // P0 Prepare
  const banded = parts.some((p) => p.bandedEdges.length > 0);
  const cutIndex = add({
    phase: 'P0',
    title: msg('cut.title'),
    body: [msg('cut.body', { count: parts.length }), ...(banded ? [msg('cut.edgeBand')] : [])],
    newPartIds: [],
    showAll: true,
    highlight: parts.map((p) => p.id),
    tools: ['tape-measure', 'square', 'pencil', 'saw', ...(banded ? (['edge-banding-iron', 'edge-trimmer'] as const) : [])],
    orientation: 'flat',
    camera: 'iso-front',
    safety: ['sawing'],
  });
  if (model.holes.length > 0 || model.marks.length > 0) {
    const unverified = model.issues.filter((i) => i.code === 'HARDWARE_PROFILE_UNVERIFIED').map((i) => String(i.params.name));
    const blind = model.holes.some((h) => h.depthMm !== 'through');
    const drilled = new Set([...model.holes, ...model.marks].map((h) => h.partId));
    const bits = new Set(model.holes.filter((h) => h.purpose !== 'hinge-cup').map((h) => h.diameterMm));
    add({
      phase: 'P0',
      title: msg('drill.title'),
      body: [
        msg('drill.body'),
        ...(blind ? [msg('drill.depthStop')] : []),
        ...(unverified.length > 0 ? [msg('drill.unverified', { profiles: unverified.join(', ') })] : []),
      ],
      newPartIds: [],
      showAll: true,
      highlight: parts.filter((p) => drilled.has(p.id)).map((p) => p.id),
      tools: [
        'tape-measure',
        'square',
        'pencil',
        'drill-driver',
        ...[...bits].map(drillBit),
        ...(model.holes.some((h) => h.countersinkDiameterMm !== null) ? (['countersink-bit'] as const) : []),
        ...(model.holes.some((h) => h.purpose === 'hinge-cup') ? (['forstner-35'] as const) : []),
        ...(blind ? (['depth-stop'] as const) : []),
      ],
      orientation: 'flat',
      camera: 'iso-front',
      safety: ['drilling'],
    });
  }
  const plateParts = new Set(model.holes.filter((h) => h.purpose === 'hinge-plate' || h.purpose === 'slide-cabinet').map((h) => h.partId));
  let premountIndex: number | null = null;
  if (plateParts.size > 0) {
    const plates = model.hardware.filter((h) => h.key === 'hinge-plate').reduce((n, h) => n + h.quantity, 0);
    const slides = model.holes.some((h) => h.purpose === 'slide-cabinet');
    premountIndex = add({
      phase: 'P0',
      title: msg('premount.title'),
      body: [...(plates > 0 ? [msg('premount.hingePlates', { count: plates })] : []), ...(slides ? [msg('premount.slides')] : [])],
      newPartIds: [],
      showAll: true,
      highlight: [...plateParts],
      tools: ['drill-driver', 'driver-bits'],
      orientation: 'flat',
      camera: 'iso-front',
      safety: [],
    });
  }

  // P1 Divider sub-assemblies
  const N = columns.length;
  for (let k = 1; k <= N - 1; k += 1) {
    const shelves = shelvesOf(k);
    if (shelves.length === 0) continue;
    add({
      phase: 'P1',
      title: msg('divider.title', { divider: k, column: k }),
      body: [msg('divider.body', { divider: k, column: k, count: shelves.length }), msg('pilot.body')],
      newPartIds: notNew([dividerId(k), ...shelves]),
      tools: JOIN_TOOLS,
      orientation: 'on-back',
      camera: 'iso-front',
      safety: [],
    });
  }

  // P2 Join columns, right to left
  const tightSections = new Set(model.issues.filter((i) => i.code === 'TOOL_ACCESS_TIGHT').map((i) => i.target.id));
  for (let c = N; c >= 2; c -= 1) {
    const shelves = shelvesOf(c);
    if (shelves.length === 0) continue;
    const target = dividerId(c - 1);
    const tight = (columns[c - 2]?.sections ?? []).some((s) => tightSections.has(s.id));
    const brackets = model.hardware
      .filter((h) => h.key === 'plinth-bracket' && h.partIds.includes(target) && shelves.some((s) => h.partIds.includes(s)))
      .reduce((n, h) => n + h.quantity, 0);
    const index = add({
      phase: 'P2',
      title: c === N ? msg('joinLoose.title', { column: c, divider: c - 1 }) : msg('joinAssembly.title', { divider: c, toDivider: c - 1 }),
      body: [
        msg('join.body', { column: c, divider: c - 1, leftColumn: c - 1 }),
        ...(brackets > 0 ? [msg('join.brackets', { count: brackets, divider: c - 1, column: c })] : []),
        msg('pilot.body'),
        ...(tight ? [msg('toolAccess.body')] : []),
      ],
      newPartIds: notNew([target, ...(c === N ? shelves : [])]),
      tools: JOIN_TOOLS,
      orientation: 'on-back',
      camera: 'iso-front',
      safety: [],
    });
    for (const shelf of shelves) pairStep.set(`${target}|${shelf}`, index);
  }

  // P3 Top and bottom
  if (N > 1) {
    add({
      phase: 'P3',
      title: msg('topBottom.title'),
      body: [msg('topBottom.body'), msg('pilot.body')],
      newPartIds: notNew(['top', 'bottom', ...columns.slice(0, -1).map((_, i) => dividerId(i + 1))]),
      tools: JOIN_TOOLS,
      orientation: 'on-back',
      camera: 'iso-front',
      safety: [],
    });
  }

  // P4 Sides; left side also brings every carcass part that is not new yet.
  add({
    phase: 'P4',
    title: msg('sideLeft.title'),
    body: [msg('sideLeft.body'), msg('pilot.body')],
    newPartIds: notNew(['side:L', ...parts.filter((p) => CARCASS_ROLES.has(p.role) && p.role !== 'side-left' && p.role !== 'side-right').map((p) => p.id)]),
    tools: JOIN_TOOLS,
    orientation: 'on-back',
    camera: 'iso-front',
    safety: [],
  });
  add({
    phase: 'P4',
    title: msg('sideRight.title'),
    body: [msg('sideRight.body'), msg('pilot.body')],
    newPartIds: notNew(['side:R']),
    tools: JOIN_TOOLS,
    orientation: 'on-back',
    camera: 'iso-front',
    safety: [],
  });

  // P5 Square and back
  if (byId.has('back')) {
    const nails = doc.carcass.back.fastener === 'nail';
    add({
      phase: 'P5',
      title: msg('back.title'),
      body: [msg('back.square', { toleranceMm: SQUARE_TOLERANCE_MM }), nails ? msg('back.nails') : msg('back.screws')],
      newPartIds: ['back'],
      tools: nails ? ['tape-measure', 'square', 'hammer'] : ['tape-measure', 'square', 'drill-driver', 'driver-bits'],
      orientation: 'flat',
      camera: 'iso-back',
      safety: [],
    });
  }

  // P6 Plinth
  const rails = parts.filter((p) => p.ownerId === 'plinth').map((p) => p.id);
  if (rails.length > 0) {
    add({
      phase: 'P6',
      title: msg('plinth.title'),
      body: [msg('plinth.body'), msg('pilot.body')],
      newPartIds: rails,
      tools: JOIN_TOOLS,
      orientation: 'on-back',
      camera: 'iso-front',
      safety: [],
    });
  }

  // P7 Stand up; merged into the previous step unless the piece is tall.
  if (tall) {
    add({
      phase: 'P7',
      title: msg('standUp.title'),
      body: [msg('standUp.body'), msg('standUp.twoPeople')],
      newPartIds: [],
      tools: [],
      orientation: 'upright',
      camera: 'iso-front',
      safety: ['lifting'],
    });
  } else {
    drafts[drafts.length - 1]?.body.push(msg('standUp.body'));
  }

  // P8 Interior
  const adjustable = parts.filter((p) => p.role === 'adjustable-shelf').map((p) => p.id);
  const rail = model.hardware.some((h) => h.kind === 'rail');
  let interiorIndex: number | null = null;
  if (adjustable.length > 0 || rail || model.hardware.some((h) => h.kind === 'shelf-pin')) {
    interiorIndex = add({
      phase: 'P8',
      title: msg('interior.title'),
      body: [...(adjustable.length > 0 ? [msg('interior.shelves', { count: adjustable.length })] : []), ...(rail ? [msg('interior.rail')] : [])],
      newPartIds: adjustable,
      tools: rail ? ['drill-driver', 'driver-bits'] : [],
      orientation: 'upright',
      camera: 'iso-front',
      safety: [],
    });
  }

  // P9 Doors
  const doors = parts.filter((p) => p.role === 'door').map((p) => p.id);
  let doorsIndex: number | null = null;
  if (doors.length > 0) {
    doorsIndex = add({
      phase: 'P9',
      title: msg('doors.title', { count: doors.length }),
      body: [msg('doors.body')],
      newPartIds: doors,
      tools: ['drill-driver', 'driver-bits', 'spirit-level'],
      orientation: 'upright',
      camera: 'iso-front',
      safety: [],
    });
  }

  // P10 Drawers
  const drawerParts = parts.filter((p) => p.role.startsWith('drawer-')).map((p) => p.id);
  let drawersIndex: number | null = null;
  if (drawerParts.length > 0) {
    const drawerCount = parts.filter((p) => p.role === 'drawer-bottom').length;
    const hasFronts = parts.some((p) => p.role === 'drawer-front');
    const handleHoles = model.holes.filter((h) => h.purpose === 'handle' && byId.get(h.partId)?.role === 'drawer-front');
    drawersIndex = add({
      phase: 'P10',
      title: msg('drawers.title', { count: drawerCount }),
      body: [
        msg('drawers.boxes'),
        msg('drawers.slides'),
        ...(hasFronts ? [msg('drawers.fronts', { gapMm: doc.construction.frontGapMm })] : []),
        ...(handleHoles.length > 0 ? [msg('drawers.handleHoles')] : []),
      ],
      newPartIds: drawerParts,
      tools: [
        ...JOIN_TOOLS,
        ...[...new Set(handleHoles.map((h) => h.diameterMm))].map(drillBit),
      ],
      orientation: 'upright',
      camera: 'iso-front',
      safety: handleHoles.length > 0 ? ['drilling'] : [],
    });
  }

  // P11 Handles
  const handleParts = [...new Set(model.holes.filter((h) => h.purpose === 'handle').map((h) => h.partId))];
  let handlesIndex: number | null = null;
  if (handleParts.length > 0) {
    const count = model.hardware.filter((h) => h.kind === 'handle').reduce((n, h) => n + h.quantity, 0);
    handlesIndex = add({
      phase: 'P11',
      title: msg('handles.title'),
      body: [msg('handles.body', { count })],
      newPartIds: [],
      highlight: handleParts,
      tools: ['driver-bits'],
      orientation: 'upright',
      camera: 'iso-front',
      safety: [],
    });
  }

  // P12 Finish
  const finishIndex = add({
    phase: 'P12',
    title: msg('finish.title'),
    body: [...(tall ? [msg('finish.anchor')] : []), msg('finish.check')],
    newPartIds: [],
    highlight: [],
    tools: tall ? ['tape-measure', 'drill-driver', 'spirit-level'] : ['tape-measure'],
    orientation: 'upright',
    camera: 'iso-front',
    safety: tall ? ['wall-anchoring'] : [],
  });

  // Hardware: each item goes to the step where it is fitted.
  const stepForParts = (ids: readonly string[]): number | null => {
    const pair = pairStep.get(`${ids[0] ?? ''}|${ids[1] ?? ''}`);
    if (ids.length === 2 && pair !== undefined) return pair;
    const steps = ids.flatMap((id) => stepOf.get(id) ?? []);
    return steps.length > 0 ? Math.max(...steps) : null;
  };
  const stepForItem = (key: string, kind: string, ids: readonly string[]): number | null => {
    if (key === 'hinge-plate') return premountIndex ?? doorsIndex;
    if (kind === 'hinge' || key === 'hinge-screw') return doorsIndex;
    if (kind === 'slide' || key === 'slide-screw') return drawersIndex;
    if (kind === 'handle' || key.startsWith('handle-screw:')) return handlesIndex;
    if (kind === 'shelf-pin' || kind === 'rail' || kind === 'rail-support' || key === 'screw:clothesRail') return interiorIndex;
    return stepForParts(ids);
  };
  const put = (index: number | null, key: string, quantity: number) => {
    const draft = index === null ? undefined : drafts[index];
    if (draft) draft.hardware.set(key, (draft.hardware.get(key) ?? 0) + quantity);
  };
  for (const item of model.hardware) put(stepForItem(item.key, item.kind, item.partIds), item.key, item.quantity);
  for (const joint of model.joints) {
    if (joint.kind === 'screw-butt') put(stepForParts([joint.facePartId, joint.otherPartId]), 'glue', 1);
  }
  for (const row of hardwareRows) {
    if (row.kind === 'edge-band') put(cutIndex, row.key, row.quantity);
    if (row.kind === 'wall-anchor') put(finishIndex, row.key, row.quantity);
  }

  const visible: string[] = [];
  return drafts.map((d, i): AssemblyStep => {
    visible.push(...d.newPartIds);
    const hardware = [...d.hardware].map(([key, quantity]) => ({ key, quantity }));
    const pilots = usedPilotDiameters(doc, hardware.map((h) => h.key)).map(drillBit);
    return {
      index: i + 1,
      phase: d.phase,
      title: d.title,
      body: d.body,
      newPartIds: d.newPartIds,
      visiblePartIds: d.showAll ? parts.map((p) => p.id) : [...visible],
      highlightPartIds: d.highlight ?? d.newPartIds,
      hardware,
      tools: sortTools(d.phase === 'P0' ? d.tools : [...d.tools, ...pilots]),
      orientation: d.orientation,
      camera: d.camera,
      safety: d.safety.map((key) => ({ key: `safety.${key}` })),
    };
  });
}
