import { isLocale, type Locale } from '@/domain/locale';

export const SETTINGS_KEY = 'fd.settings';

export interface Settings {
  locale: Locale;
}

/** `de*` → German, everything else → English (plan §3.6). */
export function detectLocale(language: string | undefined): Locale {
  return language?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function loadSettings(storage: SettingsStorage | null, navigatorLanguage: string | undefined): Settings {
  const fallback: Settings = { locale: detectLocale(navigatorLanguage) };
  if (!storage) return fallback;
  let raw: string | null;
  try {
    raw = storage.getItem(SETTINGS_KEY);
  } catch {
    return fallback;
  }
  if (raw === null) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && 'locale' in parsed && isLocale(parsed.locale)) {
      return { locale: parsed.locale };
    }
  } catch {
    // Damaged settings fall back to the detected locale.
  }
  return fallback;
}

/** Returns false when storage is unavailable or full; the setting then lives in memory only. */
export function saveSettings(storage: SettingsStorage | null, settings: Settings): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify({ locale: settings.locale }));
    return true;
  } catch {
    return false;
  }
}

export function browserStorage(): SettingsStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
