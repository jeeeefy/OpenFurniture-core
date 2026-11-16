export type Locale = 'en' | 'de';

export const LOCALES: readonly Locale[] = ['en', 'de'];

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'de';
}
