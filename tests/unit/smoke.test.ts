import { describe, expect, it } from 'vitest';

describe('toolchain smoke', () => {
  it('runs in the node environment', () => {
    expect(typeof window).toBe('undefined');
  });
});
