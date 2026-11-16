import type { AssemblyStep, HardwareListRow, Part } from '@/domain';
import { toolRef } from '@/domain';
import { translateRef } from '@/i18n';
import { useT } from '@/i18n/useT';

export type StepImage = { status: 'pending' } | { status: 'ready'; url: string } | { status: 'unavailable' };

interface Props {
  step: AssemblyStep;
  image: StepImage;
  partsById: ReadonlyMap<string, Part>;
  positionOf: ReadonlyMap<string, number>;
  hardwareRows: readonly HardwareListRow[];
}

/** One assembly step (plan §6.4 "Instructions"). */
export function StepView({ step, image, partsById, positionOf, hardwareRows }: Props) {
  const { t, locale, formatMm } = useT();
  const title = translateRef(locale, step.title);
  const headingId = `step-${String(step.index)}-heading`;

  const newParts = new Map<number, { name: string; count: number }>();
  for (const id of step.newPartIds) {
    const part = partsById.get(id);
    const position = positionOf.get(id);
    if (!part || position === undefined) continue;
    const entry = newParts.get(position) ?? { name: t(`role.${part.role}`), count: 0 };
    entry.count += 1;
    newParts.set(position, entry);
  }

  const hardwareLabel = (key: string, quantity: number) => {
    const row = hardwareRows.find((r) => r.key === key);
    if (key === 'glue') return translateRef(locale, { key: 'hardware.glue', params: { joints: quantity } });
    return row ? translateRef(locale, row.label) : key;
  };
  const unitOf = (key: string) => hardwareRows.find((r) => r.key === key)?.unit ?? 'pcs';

  return (
    <article className="assembly-step" aria-labelledby={headingId} data-step={step.index} data-phase={step.phase}>
      <h4 id={headingId}>
        {t('steps.step', { index: step.index })}: {title}
      </h4>
      <div className="step-layout">
        <figure className="step-figure">
          {image.status === 'ready' ? (
            <img src={image.url} alt={t('steps.imageAlt', { title })} width={1000} height={750} data-testid="step-image" />
          ) : (
            <div className="step-placeholder" role="img" aria-label={t('steps.imageAlt', { title })} data-testid="step-placeholder">
              {image.status === 'pending' ? t('steps.rendering') : t('steps.placeholder')}
            </div>
          )}
        </figure>
        <div className="step-text">
          {step.body.map((ref, i) => (
            <p key={`${ref.key}-${String(i)}`}>{translateRef(locale, ref)}</p>
          ))}
          {step.safety.map((ref) => (
            <p key={ref.key} className="banner step-safety" role="note">
              ⚠ {translateRef(locale, ref)}
            </p>
          ))}
          <dl className="step-facts">
            <dt>{t('steps.newParts')}</dt>
            <dd data-testid="step-new-parts">
              {newParts.size === 0
                ? '—'
                : [...newParts]
                    .sort(([a], [b]) => a - b)
                    .map(([position, p]) => t('steps.part', { position, name: p.name, count: p.count }))
                    .join(', ')}
            </dd>
            <dt>{t('steps.hardware')}</dt>
            <dd>
              {step.hardware.length === 0 ? (
                '—'
              ) : (
                <ul data-testid="step-hardware">
                  {step.hardware.map((h) => (
                    <li key={h.key} data-key={h.key}>
                      {h.key === 'glue' ? hardwareLabel(h.key, h.quantity) : `${formatMm(h.quantity)} ${t(`unit.${unitOf(h.key)}`)} – ${hardwareLabel(h.key, h.quantity)}`}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
            <dt>{t('steps.tools')}</dt>
            <dd data-testid="step-tools">{step.tools.length === 0 ? '—' : step.tools.map((tool) => translateRef(locale, toolRef(tool))).join(', ')}</dd>
            <dt>{t('steps.orientation')}</dt>
            <dd>{t(`orientation.${step.orientation}`)}</dd>
          </dl>
        </div>
      </div>
    </article>
  );
}
