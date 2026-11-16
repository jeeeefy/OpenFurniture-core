import type { Locale } from '@/domain/locale';

const MM_INPUT = /^\d{1,4}([.,]\d)?$/;
const TOO_PRECISE = /^\d{1,4}[.,]\d{2,}$/;

export type ParseMmResult = { ok: true; value: number } | { ok: false; reason: 'empty' | 'format' | 'precision' };

/** Accepts `.` or `,` as decimal separator with at most one decimal place; never grouping. */
export function parseMmInput(text: string): ParseMmResult {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: false, reason: 'empty' };
  if (MM_INPUT.test(trimmed)) return { ok: true, value: Number(trimmed.replace(',', '.')) };
  if (TOO_PRECISE.test(trimmed)) return { ok: false, reason: 'precision' };
  return { ok: false, reason: 'format' };
}

const mmFormatters = new Map<Locale, Intl.NumberFormat>();

export function formatMm(locale: Locale, value: number): string {
  let formatter = mmFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, useGrouping: false });
    mmFormatters.set(locale, formatter);
  }
  return formatter.format(value);
}

const areaFormatters = new Map<Locale, Intl.NumberFormat>();

/** Square metres with exactly two decimals, no grouping. */
export function formatArea(locale: Locale, valueM2: number): string {
  let formatter = areaFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
    areaFormatters.set(locale, formatter);
  }
  return `${formatter.format(valueM2)} m\u00b2`;
}

export function formatDate(locale: Locale, iso: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}
