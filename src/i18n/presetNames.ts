import type { Locale } from '@/domain/locale';
import { TEMPLATE_IDS } from '@/domain/templates';
import { de } from './de';
import { en } from './en';

/**
 * Names and labels of the preset materials and hardware (`src/domain/document/defaults.ts`) are stored
 * in the design as English text. Shown in German, an unchanged preset name is translated;
 * names the user typed are left as they are.
 */
const PRESET_NAMES_DE: Readonly<Record<string, string>> = {
  'Birch plywood 18 mm': 'Birkensperrholz 18 mm',
  'Birch plywood 15 mm': 'Birkensperrholz 15 mm',
  'Birch plywood 9 mm': 'Birkensperrholz 9 mm',
  'Birch plywood 6 mm': 'Birkensperrholz 6 mm',
  'White melamine chipboard 19 mm': 'Spanplatte wei\u00df melaminbeschichtet 19 mm',
  'Countersunk wood screw 4.0 \u00d7 50': 'Senkkopf-Holzschraube 4,0 \u00d7 50',
  'Countersunk wood screw 4.0 \u00d7 40': 'Senkkopf-Holzschraube 4,0 \u00d7 40',
  'Countersunk wood screw 3.5 \u00d7 40': 'Senkkopf-Holzschraube 3,5 \u00d7 40',
  'Countersunk wood screw 3.5 \u00d7 25': 'Senkkopf-Holzschraube 3,5 \u00d7 25',
  'Countersunk screw 3.0 \u00d7 16': 'Senkkopfschraube 3,0 \u00d7 16',
  'Countersunk screw 3.5 \u00d7 16': 'Senkkopfschraube 3,5 \u00d7 16',
  'Panel pin 1.6 \u00d7 25': 'Drahtstift 1,6 \u00d7 25',
  'Steel angle bracket 40 \u00d7 40': 'Stahlwinkel 40 \u00d7 40',
  '3.5 \u00d7 16 chipboard screw': 'Spanplattenschraube 3,5 \u00d7 16',
  'Concealed cup hinge 35 mm (generic)': 'Topfscharnier 35 mm (allgemein)',
  'Ball-bearing side-mount slide (generic)': 'Kugelauszug, seitlich montiert (allgemein)',
  'Shelf pin 5 mm': 'Bodentr\u00e4ger 5 mm',
  'Bar handle 128 mm': 'B\u00fcgelgriff 128 mm',
  'Bar handle 96 mm': 'B\u00fcgelgriff 96 mm',
  Knob: 'Knopf',
  'Clothes rail \u00d825 (generic)': 'Kleiderstange \u00d825 (allgemein)',
  "Generic default \u2013 verify against your product's datasheet": 'Allgemeiner Standardwert \u2013 mit dem Datenblatt deines Produkts abgleichen',
};

/** Unchanged template names as design names, e.g. "Wardrobe" ↔ "Kleiderschrank". */
const TEMPLATE_NAMES = (() => {
  const toDe = new Map<string, string>();
  const toEn = new Map<string, string>();
  for (const id of TEMPLATE_IDS) {
    toDe.set(en[`template.${id}`], de[`template.${id}`]);
    toEn.set(de[`template.${id}`], en[`template.${id}`]);
  }
  return { toDe, toEn };
})();

export function localizeName(locale: Locale, name: string): string {
  return (locale === 'de' ? (PRESET_NAMES_DE[name] ?? TEMPLATE_NAMES.toDe.get(name)) : TEMPLATE_NAMES.toEn.get(name)) ?? name;
}

/** Applies `localizeName` to every string parameter. */
export function localizeParams<P>(locale: Locale, params: P): P {
  if (params === null || typeof params !== 'object') return params;
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, typeof value === 'string' ? localizeName(locale, value) : value]),
  ) as P;
}
