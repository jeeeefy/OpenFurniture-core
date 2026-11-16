import type { Locale } from '@/domain/locale';
import type { DomainMessageKey, MessageRef } from '@/domain/messages';
import { de } from './de';
import { en, type Messages } from './en';
import { localizeParams } from './presetNames';

export type { Locale } from '@/domain/locale';
export type { Messages } from './en';
export { formatArea, formatDate, formatMm, parseMmInput, type ParseMmResult } from './numbers';
export { plural } from './plural';
export { localizeName } from './presetNames';

export type UiKey = keyof Messages;

type ParamsOf<K extends UiKey> = Messages[K] extends (params: infer P) => string ? P : never;
export type ParamArgs<K extends UiKey> = Messages[K] extends string ? [] : [params: ParamsOf<K>];

export const dictionaries: Record<Locale, Messages> = { en, de };

export function t<K extends UiKey>(locale: Locale, key: K, ...args: ParamArgs<K>): string {
  const entry: Messages[K] = dictionaries[locale][key];
  if (typeof entry === 'string') return entry;
  return (entry as (params: unknown) => string)(localizeParams(locale, args[0]));
}

/** Renders a domain message; a domain key missing from the dictionaries is a type error here. */
export function translateRef(locale: Locale, ref: MessageRef): string {
  const entry: Messages[DomainMessageKey] = dictionaries[locale][ref.key];
  if (typeof entry === 'string') return entry;
  return (entry as (params: unknown) => string)(localizeParams(locale, ref.params ?? {}));
}
