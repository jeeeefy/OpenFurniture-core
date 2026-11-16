import type { DesignDocument } from '../document/types';
import { roundTo01 } from '../units';
import type { CutListGroup } from './cutList';

/** TYPICAL defaults when a design has no cutting settings yet. */
export const DEFAULT_SAW_KERF_MM = 3;
export const DEFAULT_SHEET_TRIM_MM = 5;

export interface SheetPlacement {
  position: number;
  partId: string;
  /** Top-left corner on the sheet; x runs along the sheet length, y along its width. */
  xMm: number;
  yMm: number;
  /** Size as placed: along the sheet length and across it. */
  alongMm: number;
  acrossMm: number;
  rotated: boolean;
}

export interface CutSheet {
  index: number;
  lengthMm: number;
  widthMm: number;
  placements: SheetPlacement[];
  /** Σ part areas on this sheet in mm². */
  usedMm2: number;
}

export interface MaterialLayout {
  materialId: string;
  /** Boards to buy per size, in the order of the material's sizes. */
  sizes: { lengthMm: number; widthMm: number; count: number }[];
  kerfMm: number;
  trimMm: number;
  /** Grain materials keep the part length along the sheet length (no rotation). */
  grain: boolean;
  sheets: CutSheet[];
  /** Parts larger than the usable area of every board size (after trimming). */
  unplaced: { position: number; partId: string }[];
  /** Σ board areas in m² (what has to be bought). */
  boardAreaM2: number;
  /** Σ part areas / Σ board areas, 0…1. */
  utilisation: number;
}

interface Item {
  position: number;
  partId: string;
  length: number;
  width: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type SortKey = (a: Item, b: Item) => number;
type Split = 'shorter-leftover' | 'longer-leftover' | 'min-area' | 'max-area';
type Fit = 'short-side' | 'area';

const tie = (a: Item, b: Item) => a.position - b.position || (a.partId < b.partId ? -1 : a.partId > b.partId ? 1 : 0);
const SORTS: SortKey[] = [
  (a, b) => b.length * b.width - a.length * a.width || tie(a, b),
  (a, b) => Math.max(b.length, b.width) - Math.max(a.length, a.width) || tie(a, b),
  (a, b) => b.length - a.length || b.width - a.width || tie(a, b),
  (a, b) => b.width - a.width || b.length - a.length || tie(a, b),
  (a, b) => b.length + b.width - (a.length + a.width) || tie(a, b),
];
const SPLITS: Split[] = ['shorter-leftover', 'longer-leftover', 'min-area', 'max-area'];
const FITS: Fit[] = ['short-side', 'area'];

/** Guillotine split of the free rectangle after placing w × h in its top-left corner. */
function split(free: Rect, w: number, h: number, rule: Split): Rect[] {
  const rightW = free.w - w;
  const bottomH = free.h - h;
  let horizontal: boolean;
  if (rule === 'shorter-leftover') horizontal = rightW <= bottomH;
  else if (rule === 'longer-leftover') horizontal = rightW > bottomH;
  else {
    const areaA = rightW * h; // vertical cut first: right piece only as high as the part
    const areaB = w * bottomH;
    horizontal = rule === 'min-area' ? areaA > areaB : areaA <= areaB;
  }
  // Horizontal: full-width strip below, right piece beside the part only.
  const right: Rect = horizontal ? { x: free.x + w, y: free.y, w: rightW, h } : { x: free.x + w, y: free.y, w: rightW, h: free.h };
  const bottom: Rect = horizontal ? { x: free.x, y: free.y + h, w: free.w, h: bottomH } : { x: free.x, y: free.y + h, w, h: bottomH };
  return [right, bottom].filter((r) => r.w > 1e-6 && r.h > 1e-6);
}

interface SheetState {
  free: Rect[];
  placements: SheetPlacement[];
  usedMm2: number;
}

function pack(items: readonly Item[], usable: Rect, kerf: number, grain: boolean, splitRule: Split, fit: Fit) {
  const sheets: SheetState[] = [];
  const unplaced: Item[] = [];
  const orientations = (item: Item) => {
    const base = [{ w: item.length + kerf, h: item.width + kerf, rotated: false }];
    return grain || item.length === item.width ? base : [...base, { w: item.width + kerf, h: item.length + kerf, rotated: true }];
  };
  const fitsEmpty = (item: Item) => orientations(item).some((o) => o.w <= usable.w + 1e-6 && o.h <= usable.h + 1e-6);

  for (const item of items) {
    if (!fitsEmpty(item)) {
      unplaced.push(item);
      continue;
    }
    let placed = false;
    for (let s = 0; s <= sheets.length && !placed; s += 1) {
      if (s === sheets.length) sheets.push({ free: [{ ...usable }], placements: [], usedMm2: 0 });
      const sheet = sheets[s];
      if (!sheet) break;
      type Candidate = { rect: number; free: Rect; o: { w: number; h: number; rotated: boolean }; score: number; score2: number };
      let best: Candidate | null = null as Candidate | null;
      sheet.free.forEach((r, ri) => {
        for (const o of orientations(item)) {
          if (o.w > r.w + 1e-6 || o.h > r.h + 1e-6) continue;
          const shortSide = Math.min(r.w - o.w, r.h - o.h);
          const longSide = Math.max(r.w - o.w, r.h - o.h);
          const area = r.w * r.h - o.w * o.h;
          const [score, score2] = fit === 'short-side' ? [shortSide, longSide] : [area, shortSide];
          if (!best || score < best.score - 1e-9 || (Math.abs(score - best.score) <= 1e-9 && score2 < best.score2 - 1e-9)) {
            best = { rect: ri, free: r, o, score, score2 };
          }
        }
      });
      if (!best) continue;
      const { rect, free, o } = best;
      sheet.free.splice(rect, 1, ...split(free, o.w, o.h, splitRule));
      sheet.placements.push({
        position: item.position,
        partId: item.partId,
        xMm: roundTo01(free.x),
        yMm: roundTo01(free.y),
        alongMm: o.rotated ? item.width : item.length,
        acrossMm: o.rotated ? item.length : item.width,
        rotated: o.rotated,
      });
      sheet.usedMm2 += item.length * item.width;
      placed = true;
    }
  }
  return { sheets, unplaced };
}

/** Lower is better: fewer sheets, then the emptiest last sheet (largest reusable offcut). */
function cost(result: ReturnType<typeof pack>): [number, number] {
  return [result.sheets.length, result.sheets.at(-1)?.usedMm2 ?? 0];
}

/**
 * Guillotine cutting layouts per material (plan L-02, added on user request): every cut runs straight
 * through the piece it divides, as with a table, panel or track saw. Several sort orders, split rules and
 * fit rules are tried; the layout with the fewest sheets wins. Saw kerf and edge trim come from the design.
 * With several board sizes, the mix with the smallest bought area wins (see `layoutWithSizes`).
 */
export function computeCuttingLayouts(doc: DesignDocument, cutList: readonly CutListGroup[]): MaterialLayout[] {
  const kerf = doc.construction.sawKerfMm ?? DEFAULT_SAW_KERF_MM;
  const trim = doc.construction.sheetTrimMm ?? DEFAULT_SHEET_TRIM_MM;
  return cutList.flatMap((group) => {
    const material = doc.materials.find((m) => m.id === group.materialId);
    if (!material) return [];
    const sizes = [material.sheet, ...(material.extraSheets ?? [])];
    const items: Item[] = group.rows.flatMap((row) =>
      row.partIds.map((partId) => ({ position: row.position, partId, length: row.cut.lengthMm, width: row.cut.widthMm })),
    );
    const chosen = layoutWithSizes(items, sizes, kerf, trim, material.hasGrain);
    const partsMm2 = chosen.sheets.reduce((s, sh) => s + sh.usedMm2, 0);
    const boardMm2 = boardArea(chosen.sheets);
    return [
      {
        materialId: group.materialId,
        sizes: sizes.map((size) => ({
          ...size,
          count: chosen.sheets.filter((s) => s.lengthMm === size.lengthMm && s.widthMm === size.widthMm).length,
        })).filter((s, i, all) => all.findIndex((o) => o.lengthMm === s.lengthMm && o.widthMm === s.widthMm) === i),
        kerfMm: kerf,
        trimMm: trim,
        grain: material.hasGrain,
        sheets: chosen.sheets.map((s, i) => ({ index: i + 1, ...s })),
        unplaced: chosen.unplaced.map(({ position, partId }) => ({ position, partId })),
        boardAreaM2: Math.round(boardMm2 / 10_000) / 100,
        utilisation: boardMm2 > 0 ? Math.round((partsMm2 / boardMm2) * 1000) / 1000 : 0,
      },
    ];
  });
}

interface Size {
  lengthMm: number;
  widthMm: number;
}

type SizedSheet = Omit<CutSheet, 'index'>;

interface Layout {
  sheets: SizedSheet[];
  unplaced: Item[];
}

const boardArea = (sheets: readonly SizedSheet[]) => sheets.reduce((s, sh) => s + sh.lengthMm * sh.widthMm, 0);

/** Best of all strategies for one board size. */
function bestSingleSize(items: readonly Item[], size: Size, kerf: number, trim: number, grain: boolean): Layout {
  // The kerf is added to every part; the last part at the far edge needs none, so the usable area grows by one kerf.
  const usable: Rect = { x: trim, y: trim, w: size.lengthMm - 2 * trim + kerf, h: size.widthMm - 2 * trim + kerf };
  let best: ReturnType<typeof pack> | null = null;
  for (const sort of SORTS) {
    const sorted = [...items].sort(sort);
    for (const splitRule of SPLITS) {
      for (const fit of FITS) {
        const result = pack(sorted, usable, kerf, grain, splitRule, fit);
        if (!best) best = result;
        else {
          const [a1, a2] = cost(result);
          const [b1, b2] = cost(best);
          if (a1 < b1 || (a1 === b1 && a2 < b2 - 1e-6)) best = result;
        }
      }
    }
  }
  const chosen = best ?? { sheets: [], unplaced: [...items] };
  return {
    sheets: chosen.sheets.map((s) => ({ ...size, placements: s.placements, usedMm2: s.usedMm2 })),
    unplaced: chosen.unplaced,
  };
}

const better = (a: Layout, b: Layout) =>
  a.unplaced.length - b.unplaced.length || boardArea(a.sheets) - boardArea(b.sheets) || a.sheets.length - b.sheets.length;

/**
 * Each size is tried as the main board. Parts that do not fit it go to the other sizes; then the last board
 * is replaced by the smallest size that takes all of its parts. The layout with the smallest bought area wins.
 */
function layoutWithSizes(items: readonly Item[], sizes: readonly Size[], kerf: number, trim: number, grain: boolean): Layout {
  let best: Layout | null = null;
  for (const [i, size] of sizes.entries()) {
    const main = bestSingleSize(items, size, kerf, trim, grain);
    let layout: Layout = main;
    if (main.unplaced.length > 0 && sizes.length > 1) {
      const rest = layoutWithSizes(main.unplaced, sizes.filter((_, k) => k !== i), kerf, trim, grain);
      layout = { sheets: [...main.sheets, ...rest.sheets], unplaced: rest.unplaced };
    }
    const last = layout.sheets.at(-1);
    if (last && sizes.length > 1) {
      const lastItems = items.filter((it) => last.placements.some((p) => p.partId === it.partId));
      for (const smaller of sizes) {
        if (smaller.lengthMm * smaller.widthMm >= last.lengthMm * last.widthMm) continue;
        const single = bestSingleSize(lastItems, smaller, kerf, trim, grain);
        const current = layout.sheets.at(-1);
        if (single.unplaced.length === 0 && single.sheets.length === 1 && current && boardArea(single.sheets) < boardArea([current])) {
          layout = { sheets: [...layout.sheets.slice(0, -1), ...single.sheets], unplaced: layout.unplaced };
        }
      }
    }
    if (!best || better(layout, best) < 0) best = layout;
  }
  return best ?? { sheets: [], unplaced: [...items] };
}
