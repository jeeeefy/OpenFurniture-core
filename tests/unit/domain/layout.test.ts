import { describe, expect, it } from 'vitest';
import { distribute, type SizeSpec } from '@/domain';

const auto = (n: number): SizeSpec[] => Array.from({ length: n }, () => ({ mode: 'auto' }));
const fixed = (valueMm: number): SizeSpec => ({ mode: 'fixed', valueMm });

describe('distribute (plan §4.4)', () => {
  it.each([
    [1892, 5, [379, 379, 378, 378, 378]],
    [1528, 3, [510, 509, 509]],
    [887, 4, [222, 222, 222, 221]],
    [1527.5, 3, [509, 509, 509.5]],
    [746, 2, [373, 373]],
  ])('%d over %d auto specs', (available, n, sizes) => {
    expect(distribute(available, auto(n), 0)).toEqual({ ok: true, sizes });
  });

  it('mixes fixed and auto specs in order', () => {
    expect(distribute(1000, [fixed(300), { mode: 'auto' }, fixed(200), { mode: 'auto' }], 50)).toEqual({
      ok: true,
      sizes: [300, 250, 200, 250],
    });
  });

  it('requires all-fixed specs to match within ±0.05', () => {
    expect(distribute(500, [fixed(250), fixed(250.04)], 50).ok).toBe(true);
    expect(distribute(500, [fixed(250), fixed(250.1)], 50)).toEqual({ ok: false, reason: 'DONT_FIT' });
  });

  it('reports DONT_FIT when auto specs cannot reach the minimum', () => {
    expect(distribute(250, [fixed(100), { mode: 'auto' }, { mode: 'auto' }], 100)).toEqual({ ok: false, reason: 'DONT_FIT' });
  });

  it('reports TOO_SMALL for fixed sizes below the minimum', () => {
    expect(distribute(500, [fixed(40), { mode: 'auto' }], 50)).toEqual({
      ok: false,
      reason: 'TOO_SMALL',
      sizes: [40, 460],
      tooSmall: [0],
    });
  });
});
