import { describe, expect, it } from 'vitest';
import { presetHardware, presetMaterials, TEMPLATE_IDS } from '@/domain';
import { localizeName, t, translateRef } from '@/i18n';

const LANGUAGE_NEUTRAL = new Set(['MDF 19 mm', 'HDF 3 mm']);

function presetTexts(): string[] {
  const hw = presetHardware();
  const screws = [hw.carcassScrew, hw.plinthScrew, hw.drawerBoxScrew, hw.drawerBottomScrew, hw.frontScrew, hw.backScrew];
  return [
    ...presetMaterials().map((m) => m.name),
    ...screws.map((s) => s.label),
    hw.backNailLabel,
    hw.plinthBracket.label,
    hw.plinthBracket.screwLabel,
    hw.hinge.name,
    hw.hinge.screwLabel,
    hw.slide.name,
    hw.slide.screwLabel,
    hw.shelfPin.name,
    hw.clothesRail.name,
    hw.clothesRail.screwLabel,
    ...hw.handles.map((h) => h.name),
  ];
}

describe('preset names follow the language', () => {
  it('every preset material and hardware name has a German text', () => {
    const missing = presetTexts().filter((name) => !LANGUAGE_NEUTRAL.has(name) && localizeName('de', name) === name);
    expect(missing).toEqual([]);
  });

  it('English stays as stored; user-typed names stay unchanged in both languages', () => {
    expect(localizeName('en', 'Birch plywood 18 mm')).toBe('Birch plywood 18 mm');
    expect(localizeName('de', 'Mein Eichenbrett')).toBe('Mein Eichenbrett');
    expect(localizeName('en', 'Mein Eichenbrett')).toBe('Mein Eichenbrett');
  });

  it('message parameters are translated (hardware list, materials, issues)', () => {
    expect(translateRef('de', { key: 'hardware.screw', params: { label: 'Countersunk wood screw 4.0 × 50' } })).toBe(
      'Senkkopf-Holzschraube 4,0 × 50',
    );
    expect(t('de', 'material.option', { name: 'Birch plywood 18 mm', thicknessMm: 18 })).toContain('Birkensperrholz 18 mm');
  });

  it('unchanged template names as design names switch with the language', () => {
    for (const id of TEMPLATE_IDS) {
      const english = t('en', `template.${id}`);
      const german = t('de', `template.${id}`);
      expect(localizeName('de', english)).toBe(german);
      expect(localizeName('en', german)).toBe(english);
    }
  });
});
