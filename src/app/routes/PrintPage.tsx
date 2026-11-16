import { useState } from 'react';
import { hasErrors, type DesignDocument, type FurnitureModel, type Outputs, type ValidationIssue } from '@/domain';
import { localizeName } from '@/i18n';
import { useT } from '@/i18n/useT';
import { CutListTable } from '../components/CutListTable';
import { CuttingLayouts } from '../components/CuttingLayouts';
import { DrillingPlans } from '../components/DrillingPlans';
import { HardwareTable } from '../components/HardwareTable';
import { MaterialAreas } from '../components/MaterialAreas';
import { StepList, ToolsList } from '../components/Instructions';
import { BlockedIssues, SafetyNotes, WarningList } from '../components/IssueLists';
import { useStepImages } from '../components/useStepImages';
import { useApp } from '../context';
import { selectDerived, selectOutputs } from '../store/selectors';
import { useDesignDocument } from '../useDesignDocument';
import { DesignLoadMessage } from './OutputsPage';

function Toolbar({ designId, ready, blocked }: { designId: string; ready: boolean; blocked: boolean }) {
  const { t } = useT();
  const { routes } = useApp();
  return (
    <div className="print-toolbar">
      <a className="button" href={routes.outputs(designId, 'cut-list')}>
        {t('print.back')}
      </a>
      <button type="button" disabled={blocked || !ready} onClick={() => window.print()}>
        {t('print.open')}
      </button>
      <span role="status" className="hint">
        {!blocked && !ready ? t('print.preparing') : ''}
      </span>
    </div>
  );
}

function SectionFooter({ doc, printedAt }: { doc: DesignDocument; printedAt: string }) {
  const { t, formatDate } = useT();
  return (
    <p className="print-footer">
      {t('print.footer', { name: doc.name, date: formatDate(printedAt), version: __APP_VERSION__ })}
    </p>
  );
}

function PrintDocument({
  doc,
  model,
  outputs,
  warnings,
}: {
  doc: DesignDocument;
  model: FurnitureModel;
  outputs: Outputs;
  warnings: ValidationIssue[];
}) {
  const { t, formatMm, formatDate, locale } = useT();
  const [printedAt] = useState(() => new Date().toISOString());
  const { pending, imageOf } = useStepImages(model, outputs.steps);
  const last = outputs.steps.at(-1);
  const cover = last ? imageOf(last.index) : ({ status: 'unavailable' } as const);
  const { widthMm, heightMm, depthMm, depthWithFrontsMm } = model.envelope;
  const footer = <SectionFooter doc={doc} printedAt={printedAt} />;

  return (
    <>
      <Toolbar designId={doc.id} ready={!pending} blocked={false} />
      <article className="print-document" data-images={pending ? 'pending' : 'done'}>
        <section className="print-section print-cover" aria-labelledby="print-title">
          <h2 id="print-title" className="print-title">{localizeName(locale, doc.name)}</h2>
          <p className="print-subtitle">{t('print.subtitle')}</p>
          {cover.status === 'ready' ? (
            <img className="print-cover-image" src={cover.url} alt={t('print.coverAlt', { name: doc.name })} width={1000} height={750} />
          ) : (
            <div className="step-placeholder print-cover-image" role="img" aria-label={t('print.coverAlt', { name: doc.name })}>
              {cover.status === 'pending' ? t('steps.rendering') : t('steps.placeholder')}
            </div>
          )}
          <dl className="print-facts">
            <dt>{t('print.envelope')}</dt>
            <dd>
              {formatMm(widthMm)} × {formatMm(heightMm)} × {formatMm(depthMm)} mm
              {depthWithFrontsMm !== depthMm && ` (${t('print.depthWithFronts', { depth: formatMm(depthWithFrontsMm) })})`}
            </dd>
            <dt>{t('print.date')}</dt>
            <dd>{formatDate(printedAt)}</dd>
            <dt>{t('print.version')}</dt>
            <dd>{__APP_VERSION__}</dd>
            <dt>{t('print.language')}</dt>
            <dd>{locale === 'de' ? 'Deutsch' : 'English'}</dd>
          </dl>
        </section>

        <section className="print-section">
          <SafetyNotes headingLevel={2} />
          <WarningList doc={doc} warnings={warnings} />
          {footer}
        </section>

        <section className="print-section">
          <MaterialAreas doc={doc} cutList={outputs.cutList} layouts={outputs.cuttingLayouts} headingLevel={2} />
          {footer}
        </section>

        <section className="print-section" aria-labelledby="print-cut-list">
          <h2 id="print-cut-list">{t('outputs.tab.cut-list')}</h2>
          <CutListTable doc={doc} cutList={outputs.cutList} hardware={outputs.hardware} showAreas={false} />
          {footer}
        </section>

        <section className="print-section" aria-labelledby="print-cutting">
          <h2 id="print-cutting">{t('outputs.tab.cutting')}</h2>
          <CuttingLayouts doc={doc} outputs={outputs} editable={false} />
          {footer}
        </section>

        <section className="print-section" aria-labelledby="print-hardware">
          <h2 id="print-hardware">{t('print.hardware')}</h2>
          <HardwareTable rows={outputs.hardware} />
          {footer}
        </section>

        <section className="print-section">
          <ToolsList outputs={outputs} headingLevel={2} />
          {footer}
        </section>

        <section className="print-section" aria-labelledby="print-drilling">
          <h2 id="print-drilling">{t('outputs.tab.drilling')}</h2>
          <DrillingPlans doc={doc} plans={outputs.drillingPlans} positions={outputs.positions} />
          {footer}
        </section>

        <section className="print-section print-steps" aria-labelledby="print-steps">
          <h2 id="print-steps">{t('outputs.tab.instructions')}</h2>
          <StepList model={model} outputs={outputs} imageOf={imageOf} />
          {footer}
        </section>
      </article>
    </>
  );
}

/** Plan §6.5: A4 build document; blocked while errors exist (AC-025). */
export function PrintPage({ designId }: { designId: string }) {
  const { t } = useT();
  const state = useDesignDocument(designId);
  if (state.status !== 'ready') return <DesignLoadMessage status={state.status} />;

  const { doc } = state;
  const derived = selectDerived(doc);
  const issues = derived.ok ? derived.model.issues : derived.issues;
  const outputs = hasErrors(issues) ? null : selectOutputs(doc);

  return (
    <main className="print-page">
      {outputs && derived.ok ? (
        <PrintDocument doc={doc} model={derived.model} outputs={outputs} warnings={issues.filter((i) => i.severity === 'warning')} />
      ) : (
        <>
          <Toolbar designId={designId} ready={false} blocked />
          <h2>{t('print.blockedHeading', { name: doc.name })}</h2>
          <BlockedIssues doc={doc} derived={derived} errors={issues.filter((i) => i.severity === 'error')} />
        </>
      )}
    </main>
  );
}
