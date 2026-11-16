import { describe, expect, it } from 'vitest';
import { createDesign, deriveModel, generateOutputs, TEMPLATE_IDS } from '@/domain';
import { counterIds, NOW } from './helpers';
import { section, setColumns, carcassDesign } from './domain/fixtures';

const RUNS = 40;
const WARMUP = 5;

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? Infinity;
}

function measure(build: () => void): { p95: number; median: number } {
  for (let i = 0; i < WARMUP; i += 1) build();
  const samples: number[] = [];
  for (let i = 0; i < RUNS; i += 1) {
    const start = performance.now();
    build();
    samples.push(performance.now() - start);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  return { p95: p95(samples), median: sorted[Math.floor(sorted.length / 2)] ?? Infinity };
}

describe('performance (AC-050, NFR-02)', () => {
  it.each(TEMPLATE_IDS)('%s: derive + all generators p95 < 50 ms', (id) => {
    const doc = createDesign(id, counterIds(), NOW, id);
    const result = measure(() => {
      const derived = deriveModel(doc);
      if (derived.ok) generateOutputs(doc, derived.model);
    });
    console.log(`AC-050 ${id}: median ${result.median.toFixed(1)} ms, p95 ${result.p95.toFixed(1)} ms`);
    expect(result.p95).toBeLessThan(50);
  });

  it('a 6-column stress design (recorded only)', () => {
    const doc = carcassDesign(2400, 2200, 400);
    setColumns(doc, Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => section())));
    const result = measure(() => {
      const derived = deriveModel(doc);
      if (derived.ok) generateOutputs(doc, derived.model);
    });
    console.log(`AC-050 stress 6×6: median ${result.median.toFixed(1)} ms, p95 ${result.p95.toFixed(1)} ms`);
    expect(Number.isFinite(result.p95)).toBe(true);
  });
});
