import { hasErrors } from '@/domain';
import { useT } from '@/i18n/useT';
import { CutListTable } from '../components/CutListTable';
import { CuttingLayouts } from '../components/CuttingLayouts';
import { DrillingPlans } from '../components/DrillingPlans';
import { HardwareTable } from '../components/HardwareTable';
import { Instructions } from '../components/Instructions';
import { BlockedIssues, SafetyNotes, WarningList } from '../components/IssueLists';
import { useApp } from '../context';
import { fdLinks, LinkList } from '../links';
import { OUTPUT_TABS, type OutputTab } from '../router';
import { selectDerived, selectOutputs } from '../store/selectors';
import { useDesignDocument } from '../useDesignDocument';

export function DesignLoadMessage({ status }: { status: 'loading' | 'missing' }) {
  const { t } = useT();
  const { routes } = useApp();
  if (status === 'loading') return <main className="editor-message">{t('editor.loading')}</main>;
  return (
    <main className="editor-message">
      <h2>{t('editor.notFound')}</h2>
      <a href={routes.start()}>{t('nav.designs')}</a>
    </main>
  );
}

export function OutputsPage({ designId, tab }: { designId: string; tab: OutputTab }) {
  const { t } = useT();
  const { routes } = useApp();
  const state = useDesignDocument(designId);
  if (state.status !== 'ready') return <DesignLoadMessage status={state.status} />;

  const { doc } = state;
  const derived = selectDerived(doc);
  const issues = derived.ok ? derived.model.issues : derived.issues;
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const outputs = hasErrors(issues) ? null : selectOutputs(doc);

  return (
    <main className="outputs-page">
      <div className="outputs-bar">
        <a className="button" href={routes.editor(designId)}>
          {t('outputs.backToEditor')}
        </a>
        <h2>{t('outputs.heading', { name: doc.name })}</h2>
        {outputs ? (
          <a className="button primary" href={routes.print(designId)}>
            {t('print.open')}
          </a>
        ) : (
          <button type="button" disabled>
            {t('print.open')}
          </button>
        )}
        <LinkList links={fdLinks().outputs} designId={designId} />
      </div>
      <nav aria-label={t('outputs.tabs')} className="outputs-tabs">
        {OUTPUT_TABS.map((id) => (
          <a key={id} href={routes.outputs(designId, id)} aria-current={id === tab ? 'page' : undefined}>
            {t(`outputs.tab.${id}`)}
          </a>
        ))}
      </nav>

      {errors.length > 0 ? (
        <BlockedIssues doc={doc} derived={derived} errors={errors} />
      ) : (
        <>
          <WarningList doc={doc} warnings={warnings} />
          {outputs && tab === 'cut-list' && (
            <CutListTable doc={doc} cutList={outputs.cutList} hardware={outputs.hardware} layouts={outputs.cuttingLayouts} />
          )}
          {outputs && tab === 'cutting' && <CuttingLayouts doc={doc} outputs={outputs} />}
          {outputs && tab === 'hardware' && <HardwareTable rows={outputs.hardware} />}
          {outputs && tab === 'drilling' && (
            <DrillingPlans doc={doc} plans={outputs.drillingPlans} positions={outputs.positions} />
          )}
          {outputs && derived.ok && tab === 'instructions' && <Instructions model={derived.model} outputs={outputs} />}
          <SafetyNotes />
        </>
      )}
    </main>
  );
}
