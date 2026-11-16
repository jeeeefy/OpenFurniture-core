import { describe, expect, it } from 'vitest';
import { createDesign, deriveModel, generateOutputs, TEMPLATE_IDS } from '@/domain';
import { counterIds, NOW } from '../helpers';
import { cabinetDesign, chestDesign, model, part, sideboardDesign, size } from './fixtures';

const EXPECTED_UNVERIFIED: Record<string, string[]> = {
  bookcase: [],
  cabinet: ['handle:h-bar-128', 'hinge'],
  sideboard: ['handle:h-bar-128', 'hinge', 'slide'],
  chest: ['handle:h-bar-128', 'slide'],
  wardrobe: ['clothesRail', 'handle:h-bar-128', 'hinge'],
  blank: [],
};

describe('templates (T-020)', () => {
  it('the start page order is bookcase, cabinet, sideboard, chest, wardrobe, blank', () => {
    expect(TEMPLATE_IDS).toEqual(['bookcase', 'cabinet', 'sideboard', 'chest', 'wardrobe', 'blank']);
  });

  it.each(TEMPLATE_IDS)('AC-001: %s derives with 0 errors and exactly the expected warnings', (id) => {
    const doc = createDesign(id, counterIds(), NOW, id);
    const result = deriveModel(doc);
    if (!result.ok) throw new Error(result.issues.map((i) => i.code).join());
    const issues = result.model.issues;
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    const tall = id === 'blank' ? [] : ['TALL_FURNITURE_ANCHOR'];
    expect(issues.filter((i) => i.code !== 'HARDWARE_PROFILE_UNVERIFIED').map((i) => i.code)).toEqual(tall);
    expect(
      issues
        .filter((i) => i.code === 'HARDWARE_PROFILE_UNVERIFIED')
        .map((i) => String(i.params.profile))
        .sort(),
    ).toEqual(EXPECTED_UNVERIFIED[id]);
    expect(generateOutputs(doc, result.model).cutList.length).toBeGreaterThan(0);
  });

  it('templates equal the test fixtures used by CON-004/005/013 (same geometry)', () => {
    const geometry = (doc: ReturnType<typeof cabinetDesign>) =>
      model(doc).parts.map((p) => [p.role, p.lengthMm, p.widthMm, p.thicknessMm, ...p.box.min]).sort();
    expect(geometry(createDesign('cabinet', counterIds(), NOW, 'c'))).toEqual(geometry(cabinetDesign()));
    expect(geometry(createDesign('sideboard', counterIds(), NOW, 's'))).toEqual(geometry(sideboardDesign()));
    expect(geometry(createDesign('chest', counterIds(), NOW, 'c'))).toEqual(geometry(chestDesign()));
  });

  it('wardrobe: rail column 473 wide, 350 mm top compartment, doors with 4 and 5 hinges', () => {
    const doc = createDesign('wardrobe', counterIds(), NOW, 'w');
    const m = model(doc);
    expect(m.layout.columns.map((c) => c.widthMm)).toEqual([473, 473]);
    expect(m.layout.columns[0]!.sections.map((s) => s.heightMm)).toEqual([1696, 350]);
    const out = generateOutputs(doc, m);
    expect(out.hardware.find((r) => r.key === 'rail:469')?.quantity).toBe(1);
    // All three doors hinge on the outer sides: 4 + 2 + 5 full-overlay hinges.
    expect(out.hardware.find((r) => r.key === 'hinge:full')?.quantity).toBe(11);
    expect(out.hardware.find((r) => r.key === 'hinge:half')).toBeUndefined();
  });

  it('CON-012: cabinet fronts in melamine → door cut size 794 × 394.5', () => {
    const doc = createDesign('cabinet', counterIds(), NOW, 'c');
    doc.carcass.materialIds.fronts = 'mat-mel-19';
    const m = model(doc);
    const leaf = m.parts.find((p) => p.role === 'door')!;
    expect(size(part(m, leaf.id))).toEqual([796, 396.5, 19]);
    const row = generateOutputs(doc, m).cutList.find((g) => g.materialId === 'mat-mel-19')?.rows[0];
    expect(row?.cut).toEqual({ lengthMm: 794, widthMm: 394.5 });
  });
});
