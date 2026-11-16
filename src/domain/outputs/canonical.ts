/** Deterministic JSON: sorted object keys, numbers rounded to 0.1 mm, 2-space indentation. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalise(value), null, 2);
}

function normalise(value: unknown): unknown {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Non-finite number in canonical output: ${String(value)}`);
    const rounded = Math.round((value + Number.EPSILON) * 10) / 10;
    return Object.is(rounded, -0) ? 0 : rounded;
  }
  if (Array.isArray(value)) return value.map(normalise);
  if (value instanceof Map) return normalise(Object.fromEntries(value));
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const child = (value as Record<string, unknown>)[key];
      if (child !== undefined) out[key] = normalise(child);
    }
    return out;
  }
  return value;
}
