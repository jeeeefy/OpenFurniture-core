import { describe, expect, it } from 'vitest';
import { generateOutputs, type DesignDocument, type FurnitureModel } from '@/domain';
import { doorHandleY } from '@/domain/rules/handles';
import { cabinetDesign, carcassDesign, codes, model, section, setColumns, sideboardDesign } from './fixtures';

const hw = (m: FurnitureModel, doc: DesignDocument, key: string) =>
  generateOutputs(doc, m).hardware.find((row) => row.key === key);
const handleHoles = (m: FurnitureModel, partId: string) => m.holes.filter((h) => h.partId === partId && h.purpose === 'handle');

describe('handles (T-018)', () => {
  it('CON-017: cabinet left leaf handle at x 358.5, y 754 / 882, screw M4 × 30', () => {
    const doc = cabinetDesign();
    const m = model(doc);
    const leaf = `door:${doc.layout.columns[0]!.sections[0]!.id}:L`;
    // Door frame: u = y − yB (102), v = x − xL (2).
    expect(handleHoles(m, leaf).map((h) => [h.vMm + 2, h.uMm + 102])).toEqual([
      [358.5, 754],
      [358.5, 882],
    ]);
    expect(handleHoles(m, leaf).every((h) => h.face === 'A' && h.depthMm === 'through' && h.diameterMm === 5)).toBe(true);
    const right = `door:${doc.layout.columns[0]!.sections[0]!.id}:R`;
    expect(handleHoles(m, right).map((h) => h.vMm + 401.5)).toEqual([441.5, 441.5]);
    expect(hw(m, doc, 'handle:h-bar-128')).toMatchObject({ quantity: 2, spareIncluded: 0, verified: false });
    expect(hw(m, doc, 'handle-screw:30')).toMatchObject({ quantity: 5, label: { key: 'hardware.screw', params: { label: 'M4 × 30' } } });
  });

  it('CON-017: sideboard drawer handles centred on the front, screw M4 × 45', () => {
    const doc = sideboardDesign();
    const m = model(doc);
    // CON-017 states x 736 / 864 (centre 800). The rules give columns 510/509/509, so the front spans
    // 538.5–1062.5 with its centre at 800.5 (reported to the user in docs/progress.md).
    expect(handleHoles(m, 'drw:sb-d1:front').map((h) => [h.uMm + 538.5, h.vMm])).toEqual([
      [736.5, 115],
      [864.5, 115],
    ]);
    expect(hw(m, doc, 'handle-screw:45')?.quantity).toBe(Math.ceil(6 * 1.1));
  });

  it('AC-014: door handle height rule', () => {
    expect(doorHandleY(102, 898)).toBe(818);
    expect(doorHandleY(1100, 2198)).toBe(1180);
    expect(doorHandleY(102, 2198)).toBe(1000);
  });

  it('AC-014 / AC-030: no listed screw long enough → warning with the required length', () => {
    const doc = sideboardDesign();
    doc.hardware.handles[0]!.screwEngagementMm = 20;
    const m = model(doc);
    const warning = m.issues.find((i) => i.code === 'HANDLE_SCREW_LENGTH_UNAVAILABLE');
    expect(warning).toMatchObject({ severity: 'warning', target: { kind: 'profile', id: 'h-bar-128', field: 'screwLengthsMm' } });
    expect(warning?.params.requiredMm).toBe(53);
    expect(hw(m, doc, 'handle-screw:53')).toBeDefined();
    doc.hardware.handles[0]!.screwLengthsMm = [22, 30, 55];
    expect(codes(model(doc))).not.toContain('HANDLE_SCREW_LENGTH_UNAVAILABLE');
  });

  it('HANDLE_DOES_NOT_FIT when the holes come too close to an edge', () => {
    const doc = sideboardDesign();
    doc.hardware.handles[0]!.centerDistanceMm = 520;
    expect(model(doc).issues).toContainEqual(expect.objectContaining({ code: 'HANDLE_DOES_NOT_FIT', severity: 'error' }));
  });

  it('knobs get a single hole; fronts without a handle get none', () => {
    const doc = carcassDesign(600, 720, 450);
    setColumns(doc, [[section({ mode: 'auto' }, { front: { kind: 'door', hinge: 'right', handleId: 'h-knob' } })]]);
    const m = model(doc);
    expect(m.holes.filter((h) => h.purpose === 'handle')).toHaveLength(1);
    doc.layout.columns[0]!.sections[0]!.front = { kind: 'door', hinge: 'right', handleId: null };
    expect(model(doc).holes.filter((h) => h.purpose === 'handle')).toHaveLength(0);
  });
});

describe('drawer front attachment (T-018)', () => {
  it('CON-016: sideboard fronts get 4 screws each → 12 → 14 incl. spare', () => {
    const doc = sideboardDesign();
    const m = model(doc);
    const attach = m.holes.filter((h) => h.purpose === 'front-attach');
    expect(attach).toHaveLength(12);
    expect(attach.filter((h) => h.partId === 'drw:sb-d1:inFront').map((h) => [h.uMm, Math.round(h.vMm * 10) / 10])).toEqual([
      [60, 58.7],
      [60, 117.3],
      [393.6, 58.7],
      [393.6, 117.3],
    ]);
    expect(attach.every((h) => h.face === 'B')).toBe(true);
    expect(m.joints.filter((j) => j.kind === 'screw-face')).toHaveLength(3);
    expect(hw(m, doc, 'screw:frontScrew')).toMatchObject({ quantity: 14, spareIncluded: 2 });
  });

  it('SCREW_TOO_LONG for the front screw (AC-030)', () => {
    const doc = sideboardDesign();
    doc.hardware.frontScrew.lengthMm = 30;
    expect(codes(model(doc))).not.toContain('SCREW_TOO_LONG');
    doc.hardware.frontScrew.lengthMm = 31;
    expect(model(doc).issues).toContainEqual(
      expect.objectContaining({ code: 'SCREW_TOO_LONG', target: { kind: 'profile', id: 'frontScrew', field: 'lengthMm' } }),
    );
  });
});
