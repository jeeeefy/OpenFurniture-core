import { useState } from 'react';
import type { OpResult } from '@/domain';
import { formatMm, parseMmInput, translateRef } from '@/i18n';
import { useT } from '@/i18n/useT';

export interface ListFieldProps {
  id: string;
  label: string;
  values: readonly number[];
  /** Allow negative values (offsets relative to a centre). */
  signed?: boolean;
  onCommit: (values: number[]) => OpResult;
}

function parseList(text: string, signed: boolean): number[] | null {
  const items = text.split(';').map((s) => s.trim()).filter((s) => s !== '');
  if (items.length === 0) return null;
  const values: number[] = [];
  for (const item of items) {
    const negative = signed && item.startsWith('-');
    const parsed = parseMmInput(negative ? item.slice(1) : item);
    if (!parsed.ok) return null;
    values.push(negative ? -parsed.value : parsed.value);
  }
  return values;
}

/** Millimetre list such as slide lengths, entered as "250; 300; 350". */
export function ListField({ id, label, values, signed = false, onCommit }: ListFieldProps) {
  const { t, locale } = useT();
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const shown = draft ?? values.map((v) => formatMm(locale, v)).join('; ');

  const commit = () => {
    if (draft === null) return;
    const parsed = parseList(draft, signed);
    if (!parsed) {
      setMessage(t('number.list'));
      return;
    }
    const result = onCommit(parsed);
    if (result.ok) {
      setDraft(null);
      setMessage(null);
    } else setMessage(translateRef(locale, { key: `op.${result.reason}` }));
  };

  return (
    <div className="field">
      <label htmlFor={id}>{`${label} (mm)`}</label>
      <input
        id={id}
        value={shown}
        inputMode="decimal"
        aria-invalid={message !== null}
        aria-describedby={message !== null ? `${id}-message` : undefined}
        onChange={(e) => {
          setDraft(e.target.value);
          setMessage(null);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setDraft(null);
            setMessage(null);
          }
        }}
      />
      {message !== null && (
        <p id={`${id}-message`} className="field-message" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
