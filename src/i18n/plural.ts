import type { Locale } from '@/domain/locale';

export interface PluralForms {
  one: string;
  other: string;
}

const rules = new Map<Locale, Intl.PluralRules>();

/** Picks the plural form for `count`; `{count}` in the chosen form is replaced by the count. */
export function plural(locale: Locale, count: number, forms: PluralForms): string {
  let rule = rules.get(locale);
  if (!rule) {
    rule = new Intl.PluralRules(locale);
    rules.set(locale, rule);
  }
  const form = rule.select(count) === 'one' ? forms.one : forms.other;
  return form.replace('{count}', String(count));
}
