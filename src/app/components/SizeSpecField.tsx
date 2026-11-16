import type { OpResult, SizeSpec } from '@/domain';
import { useT } from '@/i18n/useT';
import { NumberField } from './NumberField';

export interface SizeSpecFieldProps {
  fieldId: string;
  legend: string;
  label: string;
  spec: SizeSpec;
  /** Resolved size, used as the starting value when switching to "fixed". */
  resolvedMm: number | null;
  min: number;
  max: number;
  onCommit: (spec: SizeSpec) => OpResult;
}

/** Auto/fixed choice for column widths and section heights; fixed values use the NumberField. */
export function SizeSpecField({ fieldId, legend, label, spec, resolvedMm, min, max, onCommit }: SizeSpecFieldProps) {
  const { t } = useT();
  const name = `${fieldId}-mode`;
  return (
    <fieldset id={fieldId}>
      <legend>{legend}</legend>
      <label>
        <input type="radio" name={name} checked={spec.mode === 'auto'} onChange={() => onCommit({ mode: 'auto' })} />
        {t('size.auto')}
      </label>
      <label>
        <input
          type="radio"
          name={name}
          checked={spec.mode === 'fixed'}
          onChange={() => onCommit({ mode: 'fixed', valueMm: Math.min(max, Math.max(min, Math.round(resolvedMm ?? min))) })}
        />
        {t('size.fixed')}
      </label>
      {spec.mode === 'fixed' && (
        <NumberField
          fieldId={`${fieldId}-value`}
          label={label}
          valueMm={spec.valueMm}
          min={min}
          max={max}
          onCommit={(valueMm) => onCommit({ mode: 'fixed', valueMm })}
        />
      )}
    </fieldset>
  );
}
