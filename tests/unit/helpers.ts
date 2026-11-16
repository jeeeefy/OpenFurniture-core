import type { IdSource } from '@/domain';

/** Deterministic id source for tests: id-1, id-2, … */
export function counterIds(prefix = 'id'): IdSource {
  let n = 0;
  return () => {
    n += 1;
    return `${prefix}-${n}`;
  };
}

export const NOW = '2026-11-07T10:00:00.000Z';

export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
