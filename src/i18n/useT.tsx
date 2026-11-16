import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Locale } from '@/domain/locale';
import { formatDate, formatMm, t, type ParamArgs, type UiKey } from './index';

export interface I18n {
  locale: Locale;
  t: <K extends UiKey>(key: K, ...args: ParamArgs<K>) => string;
  formatMm: (value: number) => string;
  formatDate: (iso: string) => string;
}

function createI18n(locale: Locale): I18n {
  return {
    locale,
    t: (key, ...args) => t(locale, key, ...args),
    formatMm: (value) => formatMm(locale, value),
    formatDate: (iso) => formatDate(locale, iso),
  };
}

const I18nContext = createContext<I18n>(createI18n('en'));

export const I18nContextConsumer = I18nContext.Consumer;

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => createI18n(locale), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18n {
  return useContext(I18nContext);
}
