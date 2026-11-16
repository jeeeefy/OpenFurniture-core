import { useId, useState } from 'react';
import type { OpResult } from '@/domain';
import { parseMmInput, translateRef } from '@/i18n';
import { useT } from '@/i18n/useT';

export interface NumberFieldProps {
  label: string;
  valueMm: number;
  min: number;
  max: number;
  /** Called once per accepted value; the result of the operation decides whether the text is kept. */
  onCommit: (valueMm: number) => OpResult;
  /** Stable id so the validation panel can focus this field (plan §6.2). */
  fieldId?: string;
  /** Whole-number count instead of millimetres. */
  integer?: boolean;
}

/**
 * Millimetre input (plan §6.2): accepts "12,5" and "12.5", commits on Enter or blur, Escape reverts.
 * Invalid text stays visible with a message and is never committed.
 */
export function NumberField({ label, valueMm, min, max, onCommit, fieldId, integer = false }: NumberFieldProps) {
  const { t, formatMm, locale } = useT();
  const generatedId = useId();
  const inputId = fieldId ?? generatedId;
  const messageId = `${inputId}-message`;
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const shown = draft ?? formatMm(valueMm);

  const revert = () => {
    setDraft(null);
    setMessage(null);
  };

  const commit = () => {
    if (draft === null) return;
    const parsed = parseMmInput(draft);
    if (!parsed.ok) {
      setMessage(t(`number.${parsed.reason}`));
      return;
    }
    if (integer && !Number.isInteger(parsed.value)) {
      setMessage(t('number.integer'));
      return;
    }
    if (parsed.value < min || parsed.value > max) {
      setMessage(integer ? t('number.rangeCount', { min, max }) : t('number.range', { min, max }));
      return;
    }
    if (parsed.value === valueMm) {
      revert();
      return;
    }
    const result = onCommit(parsed.value);
    if (result.ok) revert();
    else setMessage(translateRef(locale, { key: `op.${result.reason}` }));
  };

  return (
    <div className="field">
      <label htmlFor={inputId}>
        {integer ? t('number.labelCount', { label, min, max }) : t('number.label', { label, min, max })}
      </label>
      <input
        id={inputId}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={shown}
        aria-invalid={message !== null}
        aria-describedby={message !== null ? messageId : undefined}
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
            revert();
          }
        }}
      />
      {message !== null && (
        <p id={messageId} className="field-message" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
