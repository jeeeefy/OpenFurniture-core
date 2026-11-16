import { DEFAULT_HANDLE_ID } from '../document/defaults';
import type { DesignDocument, Front } from '../document/types';
import type { IdSource } from '../ids';
import { fixed, makeColumn, makeDocument, TEMPLATE_PLINTH, templateCarcass } from './builders';

const door = (hinge: 'left' | 'right'): Front => ({ kind: 'door', hinge, handleId: DEFAULT_HANDLE_ID });

function drawers(newId: IdSource, count: number): Front {
  return {
    kind: 'drawers',
    handleId: DEFAULT_HANDLE_ID,
    drawers: Array.from({ length: count }, () => ({ id: newId(), frontHeight: { mode: 'auto' as const } })),
  };
}

/** 800 × 900 × 450 with plinth; one section with 2 adjustable shelves behind a double door. */
export function createCabinet(newId: IdSource, nowIso: string, name: string): DesignDocument {
  return makeDocument(newId, nowIso, name, templateCarcass(800, 900, 450, TEMPLATE_PLINTH), () => [
    makeColumn(newId, [
      { interior: { kind: 'adjustableShelves', count: 2 }, front: { kind: 'doubleDoor', handleId: DEFAULT_HANDLE_ID } },
    ]),
  ]);
}

/** 1600 × 800 × 450 with plinth; door left + shelf, 3 drawers, door right + shelf. */
export function createSideboard(newId: IdSource, nowIso: string, name: string): DesignDocument {
  return makeDocument(newId, nowIso, name, templateCarcass(1600, 800, 450, TEMPLATE_PLINTH), () => {
    const left = makeColumn(newId, [{ interior: { kind: 'adjustableShelves', count: 1 }, front: door('left') }]);
    const middleId = newId();
    const middleSection = newId();
    const middle = {
      id: middleId,
      width: { mode: 'auto' as const },
      sections: [{ id: middleSection, height: { mode: 'auto' as const }, interior: { kind: 'empty' as const }, front: drawers(newId, 3) }],
    };
    const right = makeColumn(newId, [{ interior: { kind: 'adjustableShelves', count: 1 }, front: door('right') }]);
    return [left, middle, right];
  });
}

/** 800 × 1000 × 450 with plinth; one section with 4 drawers. */
export function createChest(newId: IdSource, nowIso: string, name: string): DesignDocument {
  return makeDocument(newId, nowIso, name, templateCarcass(800, 1000, 450, TEMPLATE_PLINTH), () => {
    const columnId = newId();
    const sectionId = newId();
    return [
      {
        id: columnId,
        width: { mode: 'auto' as const },
        sections: [{ id: sectionId, height: { mode: 'auto' as const }, interior: { kind: 'empty' as const }, front: drawers(newId, 4) }],
      },
    ];
  });
}

/** 1000 × 2200 × 600 with plinth; col 1 rail + door and a 350 mm top compartment with door; col 2 shelves + door. */
export function createWardrobe(newId: IdSource, nowIso: string, name: string): DesignDocument {
  return makeDocument(newId, nowIso, name, templateCarcass(1000, 2200, 600, TEMPLATE_PLINTH), () => [
    makeColumn(newId, [
      { interior: { kind: 'clothesRail' }, front: door('left') },
      { height: fixed(350), front: door('left') },
    ]),
    makeColumn(newId, [{ interior: { kind: 'adjustableShelves', count: 5 }, front: door('right') }]),
  ]);
}
