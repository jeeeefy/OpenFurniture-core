import type { DeriveResult, DesignDocument, ValidationIssue } from '@/domain';
import { translateRef } from '@/i18n';
import { useT } from '@/i18n/useT';
import { useApp } from '../context';
import { issueNavigation } from '../store/issueTargets';
import { targetLabel } from './ValidationPanel';

function IssueText({ doc, issue }: { doc: DesignDocument; issue: ValidationIssue }) {
  const { t, locale } = useT();
  return (
    <>
      <strong>{targetLabel(doc, issue, t)}:</strong> {translateRef(locale, { key: `issue.${issue.code}`, params: issue.params })}
    </>
  );
}

const issueKey = (issue: ValidationIssue, i: number) => `${issue.code}-${issue.target.id}-${String(i)}`;

/** Errors that block outputs and print, each with "Fix in editor" (AC-025). */
export function BlockedIssues({ doc, derived, errors }: { doc: DesignDocument; derived: DeriveResult; errors: ValidationIssue[] }) {
  const { t } = useT();
  const { editor, routes } = useApp();
  const fixInEditor = (issue: ValidationIssue) => {
    const target = issueNavigation(doc, derived.ok ? derived.model : null, issue);
    editor.getState().setPendingTarget({ designId: doc.id, ...target });
    window.location.hash = routes.editor(doc.id);
  };
  return (
    <section className="outputs-blocked" aria-labelledby="blocked-heading" data-testid="outputs-blocked">
      <h3 id="blocked-heading">{t('outputs.blocked')}</h3>
      <ul>
        {errors.map((issue, i) => (
          <li key={issueKey(issue, i)} data-code={issue.code}>
            <IssueText doc={doc} issue={issue} />{' '}
            <button type="button" onClick={() => fixInEditor(issue)}>
              {t('outputs.fixInEditor')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function WarningList({ doc, warnings }: { doc: DesignDocument; warnings: ValidationIssue[] }) {
  const { t } = useT();
  if (warnings.length === 0) return null;
  return (
    <section className="outputs-warnings" aria-labelledby="warnings-heading" data-testid="outputs-warnings">
      <h3 id="warnings-heading">{t('outputs.warnings')}</h3>
      <ul>
        {warnings.map((issue, i) => (
          <li key={issueKey(issue, i)} data-code={issue.code}>
            <IssueText doc={doc} issue={issue} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Plan §7.4: safety texts shown in the app and in print (AC-037). */
export function SafetyNotes({ headingLevel = 3 }: { headingLevel?: 2 | 3 }) {
  const { t } = useT();
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <section className="safety-notes" aria-labelledby="safety-heading" data-testid="safety-notes">
      <Heading id="safety-heading">{t('notes.heading')}</Heading>
      <ul>
        <li>{t('notes.planningAid')}</li>
        <li>{t('notes.wallAnchor')}</li>
        <li>{t('notes.heuristics')}</li>
        <li>{t('notes.datasheets')}</li>
        <li>{t('notes.toolSafety')}</li>
      </ul>
    </section>
  );
}
