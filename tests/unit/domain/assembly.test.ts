import { describe, expect, it } from 'vitest';
import {
  generateOutputs,
  positionByPartId,
  TEMPLATE_IDS,
  type AssemblyStep,
  type DesignDocument,
  type FurnitureModel,
} from '@/domain';
import { carcassDesign, model, section, setColumns, template } from './fixtures';

const PHASES = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12'];

function outputs(doc: DesignDocument): { m: FurnitureModel; steps: AssemblyStep[]; out: ReturnType<typeof generateOutputs> } {
  const m = model(doc);
  const out = generateOutputs(doc, m);
  return { m, steps: out.steps, out };
}

const titles = (steps: AssemblyStep[], phase: string) =>
  steps.filter((s) => s.phase === phase).map((s) => ({ key: s.title.key, params: s.title.params }));

function con014(): DesignDocument {
  const doc = carcassDesign(1200, 2000, 300);
  setColumns(doc, [
    [section(), section(), section(), section()],
    [section(), section(), section()],
    [section(), section(), section(), section()],
  ]);
  return doc;
}

function con018(middle = 120): DesignDocument {
  const doc = carcassDesign(800, 1000, 300);
  setColumns(doc, [
    [section({ mode: 'fixed', valueMm: 473 }), section({ mode: 'fixed', valueMm: middle }), section()],
    [section({ mode: 'fixed', valueMm: 523 }), section()],
  ]);
  return doc;
}

describe('assembly planner (T-022)', () => {
  it('CON-014: divider sub-assemblies, joins right to left, top/bottom, sides', () => {
    const doc = con014();
    const { m, steps } = outputs(doc);
    expect(titles(steps, 'P1')).toEqual([
      { key: 'step.divider.title', params: { divider: 1, column: 1 } },
      { key: 'step.divider.title', params: { divider: 2, column: 2 } },
    ]);
    expect(titles(steps, 'P2')).toEqual([
      { key: 'step.joinLoose.title', params: { column: 3, divider: 2 } },
      { key: 'step.joinAssembly.title', params: { divider: 2, toDivider: 1 } },
    ]);
    expect(titles(steps, 'P3').map((t) => t.key)).toEqual(['step.topBottom.title']);
    expect(titles(steps, 'P4').map((t) => t.key)).toEqual(['step.sideLeft.title', 'step.sideRight.title']);

    const [c1, c2, c3] = doc.layout.columns;
    const shelves = (c: typeof c1) => c!.sections.slice(0, -1).map((s) => `fixed:${s.id}`);
    const p1 = steps.filter((s) => s.phase === 'P1');
    expect(p1[0]?.newPartIds).toEqual([`divider:${c1!.id}`, ...shelves(c1)]);
    expect(p1[1]?.newPartIds).toEqual([`divider:${c2!.id}`, ...shelves(c2)]);
    const p2 = steps.filter((s) => s.phase === 'P2');
    expect(p2[0]?.newPartIds).toEqual(shelves(c3));
    expect(p2[1]?.newPartIds).toEqual([]);
    // The P2 screws are counted where they are driven: column 3 shelves into V2, column 2 shelves into V1.
    const screws = (s: AssemblyStep | undefined) => s?.hardware.find((h) => h.key === 'screw:carcassScrew')?.quantity;
    expect(screws(p2[0])).toBe(m.joints.filter((j) => j.facePartId === `divider:${c2!.id}` && shelves(c3).includes(j.otherPartId)).reduce((n, j) => n + j.count, 0));
    expect(screws(p2[1])).toBeGreaterThan(0);
    expect(steps.flatMap((s) => s.body).map((b) => b.key)).not.toContain('step.toolAccess.body');
  });

  it('CON-018: the P2 step warns about tool access only for the 120 mm section', () => {
    const tight = outputs(con018()).steps.find((s) => s.phase === 'P2');
    expect(tight?.title).toEqual({ key: 'step.joinLoose.title', params: { column: 2, divider: 1 } });
    expect(tight?.body.map((b) => b.key)).toContain('step.toolAccess.body');
    const roomy = outputs(con018(200)).steps.find((s) => s.phase === 'P2');
    expect(roomy?.body.map((b) => b.key)).not.toContain('step.toolAccess.body');
  });

  describe.each(TEMPLATE_IDS)('AC-033 / AC-040: %s', (id) => {
    const doc = template(id);
    const { m, steps, out } = outputs(doc);

    it('follows the phase order and introduces every part exactly once in P1–P10', () => {
      const ranks = steps.map((s) => PHASES.indexOf(s.phase));
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
      expect(steps.map((s) => s.index)).toEqual(steps.map((_, i) => i + 1));
      const introduced = steps.flatMap((s) => s.newPartIds);
      expect([...introduced].sort()).toEqual(m.parts.map((p) => p.id).sort());
      for (const s of steps) {
        if (s.newPartIds.length > 0) expect(PHASES.indexOf(s.phase)).toBeGreaterThanOrEqual(1);
        if (s.newPartIds.length > 0) expect(PHASES.indexOf(s.phase)).toBeLessThanOrEqual(10);
        expect(s.visiblePartIds.length).toBeGreaterThan(0);
        expect(s.visiblePartIds).toEqual(expect.arrayContaining(s.newPartIds));
      }
      if (['blank', 'cabinet', 'chest'].includes(id)) {
        const left = steps.find((s) => s.title.key === 'step.sideLeft.title');
        expect(left?.phase).toBe('P4');
        expect(left?.newPartIds).toEqual(expect.arrayContaining(['top', 'bottom']));
      }
    });

    it('distributes all hardware (without spares) and every glued joint over the steps', () => {
      const raw = new Map<string, number>();
      for (const h of m.hardware) raw.set(h.key, (raw.get(h.key) ?? 0) + h.quantity);
      const stepped = new Map<string, number>();
      for (const s of steps) for (const h of s.hardware) stepped.set(h.key, (stepped.get(h.key) ?? 0) + h.quantity);
      for (const [key, quantity] of raw) expect(stepped.get(key), key).toBe(quantity);
      expect(stepped.get('glue') ?? 0).toBe(m.joints.filter((j) => j.kind === 'screw-butt').length);
    });

    it('SM-1: every part is in the cut list, in a step, and in a drilling plan if drilled', () => {
      const cut = new Set(out.cutList.flatMap((g) => g.rows.flatMap((r) => r.partIds)));
      const inSteps = new Set(steps.flatMap((s) => s.newPartIds));
      const planned = new Set(out.drillingPlans.map((p) => p.position));
      const position = positionByPartId(out.positions);
      const drilled = new Set([...m.holes, ...m.marks].map((h) => h.partId));
      for (const p of m.parts) {
        expect(cut.has(p.id), p.id).toBe(true);
        expect(inSteps.has(p.id), p.id).toBe(true);
        if (drilled.has(p.id)) expect(planned.has(position.get(p.id) ?? -1), p.id).toBe(true);
      }
    });

    it('AC-035: tools are exactly what the model needs', () => {
      const bits = new Set(m.holes.filter((h) => h.purpose !== 'hinge-cup').map((h) => h.diameterMm));
      for (const k of ['carcassScrew', 'plinthScrew', 'drawerBoxScrew', 'drawerBottomScrew', 'frontScrew', 'backScrew'] as const) {
        if (m.hardware.some((h) => h.key === `screw:${k}`)) bits.add(doc.hardware[k].pilotHoleMm);
      }
      const tools = out.tools;
      expect(tools.filter((t) => t.startsWith('drill-bit:')).map((t) => Number(t.slice(10))).sort((a, b) => a - b)).toEqual(
        [...bits].sort((a, b) => a - b),
      );
      expect(tools.includes('forstner-35')).toBe(m.holes.some((h) => h.purpose === 'hinge-cup'));
      expect(tools.includes('edge-banding-iron')).toBe(m.parts.some((p) => p.bandedEdges.length > 0));
      expect(tools.includes('edge-trimmer')).toBe(m.parts.some((p) => p.bandedEdges.length > 0));
      expect(tools.includes('countersink-bit')).toBe(m.holes.some((h) => h.countersinkDiameterMm !== null));
      expect(tools.includes('depth-stop')).toBe(m.holes.some((h) => h.depthMm !== 'through'));
      expect(tools.includes('hammer')).toBe(doc.carcass.back.fastener === 'nail');
      for (const s of steps) for (const t of s.tools) expect(tools).toContain(t);
    });
  });

  it('a tall piece gets a separate stand-up step with lifting safety; a low one merges it', () => {
    const tall = outputs(template('bookcase')).steps;
    const standUp = tall.find((s) => s.phase === 'P7');
    expect(standUp?.safety).toEqual([{ key: 'safety.lifting' }]);
    expect(tall.at(-1)?.body.map((b) => b.key)).toContain('step.finish.anchor');
    expect(tall.at(-1)?.hardware).toContainEqual({ key: 'wall-anchor', quantity: 1 });

    const low = outputs(carcassDesign(800, 700, 300)).steps;
    expect(low.some((s) => s.phase === 'P7')).toBe(false);
    expect(low.flatMap((s) => s.body).map((b) => b.key)).toContain('step.standUp.body');
    expect(low.find((s) => s.phase === 'P5')?.camera).toBe('iso-back');
  });

  it('shelves at equal heights across a divider: the P2 step uses angle brackets for them', () => {
    const doc = carcassDesign(800, 1000, 400);
    setColumns(doc, [
      [section({ mode: 'fixed', valueMm: 400 }), section()],
      [section({ mode: 'fixed', valueMm: 400 }), section()],
    ]);
    const { m, steps } = outputs(doc);
    expect(m.issues.filter((i) => i.severity === 'error')).toEqual([]);
    const p2 = steps.find((s) => s.phase === 'P2');
    const brackets = p2?.body.find((b) => b.key === 'step.join.brackets');
    expect(brackets?.params).toMatchObject({ divider: 1, column: 2 });
    expect(p2?.hardware.find((h) => h.key === 'plinth-bracket')?.quantity).toBe(brackets?.params?.count);
  });

  it('is deterministic', () => {
    const a = outputs(template('sideboard')).steps;
    const b = outputs(template('sideboard')).steps;
    expect(a).toEqual(b);
  });
});
