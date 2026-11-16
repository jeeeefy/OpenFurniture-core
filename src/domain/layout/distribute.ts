import type { SizeSpec } from '../document/types';
import { floorSafe } from '../units';

export type DistributeResult =
  | { ok: true; sizes: number[] }
  | { ok: false; reason: 'DONT_FIT' }
  | { ok: false; reason: 'TOO_SMALL'; sizes: number[]; tooSmall: number[] };

const roundNoise = (x: number) => Math.round(x * 1e6) / 1e6;

/** Plan §4.4: whole-mm auto sizes, earlier specs take the extra millimetres, the last auto spec the fraction. */
export function distribute(availableMm: number, specs: readonly SizeSpec[], minMm: number): DistributeResult {
  let fixedSum = 0;
  let nAuto = 0;
  for (const spec of specs) {
    if (spec.mode === 'fixed') fixedSum += spec.valueMm;
    else nAuto += 1;
  }

  let autoSizes: number[] = [];
  if (nAuto === 0) {
    if (Math.abs(fixedSum - availableMm) > 0.05) return { ok: false, reason: 'DONT_FIT' };
  } else {
    const remaining = roundNoise(availableMm - fixedSum);
    if (remaining < nAuto * minMm - 1e-9) return { ok: false, reason: 'DONT_FIT' };
    const base = floorSafe(remaining / nAuto);
    const extra = roundNoise(remaining - base * nAuto);
    const whole = floorSafe(extra);
    autoSizes = Array.from({ length: nAuto }, (_, i) => base + (i < whole ? 1 : 0));
    autoSizes[nAuto - 1] = roundNoise((autoSizes[nAuto - 1] ?? base) + extra - whole);
  }

  let autoIndex = 0;
  const sizes = specs.map((spec) => (spec.mode === 'fixed' ? spec.valueMm : (autoSizes[autoIndex++] ?? 0)));
  const tooSmall = sizes.flatMap((size, i) => (size < minMm - 1e-9 ? [i] : []));
  if (tooSmall.length > 0) return { ok: false, reason: 'TOO_SMALL', sizes, tooSmall };
  return { ok: true, sizes };
}
