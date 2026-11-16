export type Mm = number;

export const EPS = 1e-6;

/** Rounds an emitted dimension or coordinate to 0.1 mm. */
export function roundTo01(x: number): number {
  return Math.round((x + Number.EPSILON) * 10) / 10;
}

/** `Math.ceil` that ignores float noise such as 60 × 1.1 = 66.00000000000001. */
export function ceilSafe(x: number): number {
  return Math.ceil(x - 1e-9);
}

export function floorSafe(x: number): number {
  return Math.floor(x + 1e-9);
}

export function nearlyEqual(a: number, b: number, eps = EPS): boolean {
  return Math.abs(a - b) <= eps;
}
