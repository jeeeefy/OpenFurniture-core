import { useState } from 'react';
import type { OpResult } from '@/domain';
import { translateRef } from '@/i18n';
import { useT } from '@/i18n/useT';

export interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  maxLength: number;
  onCommit: (value: string) => OpResult;
}

/** Text input that commits on Enter or blur and reverts on Escape, like the NumberField. */
export function TextField({ id, label, value, maxLength, onCommit }: TextFieldProps) {
  const { locale } = useT();
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const commit = () => {
    if (draft === null || draft === value) {
      setDraft(null);
      return;
    }
    const result = onCommit(draft);
    if (result.ok) {
      setDraft(null);
      setMessage(null);
    } else setMessage(translateRef(locale, { key: `op.${result.reason}` }));
  };

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={draft ?? value}
        maxLength={maxLength}
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
