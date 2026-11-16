import { describe, expect, it } from 'vitest';
import { dictionaries, formatMm, parseMmInput, plural, t } from '@/i18n';

describe('parseMmInput (T-002)', () => {
  it.each([
    ['12,5', 12.5],
    ['12.5', 12.5],
    ['600', 600],
    [' 2400 ', 2400],
    ['0', 0],
    ['9999.9', 9999.9],
  ])('accepts %j → %d', (text, value) => {
    expect(parseMmInput(text)).toEqual({ ok: true, value });
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['1.000', 'precision'],
    ['12,34', 'precision'],
    ['-5', 'format'],
    ['1e3', 'format'],
    ['abc', 'format'],
    ['12345', 'format'],
    ['1,000.5', 'format'],
    ['.5', 'format'],
  ])('rejects %j (%s)', (text, reason) => {
    expect(parseMmInput(text)).toEqual({ ok: false, reason });
  });
});

describe('formatMm (T-002)', () => {
  it('uses the locale decimal separator without grouping', () => {
    expect(formatMm('de', 1234.5)).toBe('1234,5');
    expect(formatMm('en', 1234.5)).toBe('1234.5');
    expect(formatMm('en', 600)).toBe('600');
    expect(formatMm('de', 396.5)).toBe('396,5');
  });

  it('shows at most one decimal place', () => {
    expect(formatMm('en', 483.64)).toBe('483.6');
  });
});

describe('plural', () => {
  it('selects forms per locale', () => {
    expect(plural('en', 1, { one: '{count} error', other: '{count} errors' })).toBe('1 error');
    expect(t('en', 'issues.errors', { count: 2 })).toBe('2 errors');
    expect(t('de', 'issues.warnings', { count: 1 })).toBe('1 Warnung');
    expect(t('de', 'issues.warnings', { count: 3 })).toBe('3 Warnungen');
  });
});

describe('dictionaries (AC-048)', () => {
  // Any parameter name resolves to a sample value, so every function entry can be rendered.
  const sampleParams = new Proxy({}, { get: (_target, prop) => (prop === 'label' || prop === 'version' ? 'X' : 1) });

  for (const [locale, dict] of Object.entries(dictionaries)) {
    it(`${locale}: every entry renders a non-empty string`, () => {
      for (const [key, entry] of Object.entries(dict)) {
        const text = typeof entry === 'string' ? entry : String((entry as (p: unknown) => unknown)(sampleParams));
        expect(text.trim(), `${locale}:${key}`).not.toBe('');
      }
    });
  }

  it('both dictionaries have the same keys', () => {
    expect(Object.keys(dictionaries.de).sort()).toEqual(Object.keys(dictionaries.en).sort());
  });

  it('renders parameterised messages per locale', () => {
    expect(t('en', 'number.range', { min: 200, max: 2400 })).toBe('Enter a value from 200 to 2400 mm.');
    expect(t('de', 'number.label', { label: 'Breite', min: 0.5, max: 10 })).toBe('Breite (mm, 0,5–10)');
  });
});
