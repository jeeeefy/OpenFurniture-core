import { describe, expect, it } from 'vitest';
import { SETTINGS_KEY, detectLocale, loadSettings, saveSettings } from '@/persistence/settings';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    data,
  };
}

describe('settings (T-002)', () => {
  it('detects German for de* languages, English otherwise', () => {
    expect(detectLocale('de-CH')).toBe('de');
    expect(detectLocale('DE')).toBe('de');
    expect(detectLocale('en-US')).toBe('en');
    expect(detectLocale('fr')).toBe('en');
    expect(detectLocale(undefined)).toBe('en');
  });

  it('prefers the stored locale and falls back on damaged data', () => {
    expect(loadSettings(memoryStorage({ [SETTINGS_KEY]: '{"locale":"de"}' }), 'en').locale).toBe('de');
    expect(loadSettings(memoryStorage({ [SETTINGS_KEY]: '{"locale":"fr"}' }), 'de-AT').locale).toBe('de');
    expect(loadSettings(memoryStorage({ [SETTINGS_KEY]: 'not json' }), 'en').locale).toBe('en');
    expect(loadSettings(null, 'de').locale).toBe('de');
  });

  it('saves only the locale and reports storage failures', () => {
    const storage = memoryStorage();
    expect(saveSettings(storage, { locale: 'de' })).toBe(true);
    expect(storage.data.get(SETTINGS_KEY)).toBe('{"locale":"de"}');
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(saveSettings(full, { locale: 'en' })).toBe(false);
    expect(saveSettings(null, { locale: 'en' })).toBe(false);
  });
});
