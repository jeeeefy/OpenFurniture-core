import { useState } from 'react';
import type { DesignDocument, ValidationIssue } from '@/domain';
import { translateRef } from '@/i18n';
import { useT, type I18n } from '@/i18n/useT';
import { useApp } from '../context';
import { issueNavigation } from '../store/issueTargets';
import { selectDerived } from '../store/selectors';

function profileName(doc: DesignDocument, id: string): string {
  const { hinge, slide, clothesRail, handles } = doc.hardware;
  return [hinge, slide, clothesRail, ...handles].find((p) => p.id === id)?.name ?? id;
}

export function targetLabel(doc: DesignDocument, issue: ValidationIssue, t: I18n['t']): string {
  const { kind, id } = issue.target;
  for (const [ci, column] of doc.layout.columns.entries()) {
    if (kind === 'column' && column.id === id) return t('outline.column', { n: ci + 1 });
    for (const [si, section] of column.sections.entries()) {
      if (kind === 'section' && section.id === id) return t('target.columnSection', { column: ci + 1, section: si + 1 });
      if (kind === 'drawer' && section.front.kind === 'drawers') {
        const di = section.front.drawers.findIndex((d) => d.id === id);
        if (di >= 0) return t('target.drawer', { column: ci + 1, section: si + 1, drawer: di + 1 });
      }
    }
  }
  switch (kind) {
    case 'carcass':
      return t('outline.carcass');
    case 'material':
      return t('target.material', { name: doc.materials.find((m) => m.id === id)?.name ?? id });
    case 'profile':
      return t('target.profile', { name: profileName(doc, id) });
    case 'part': {
      const derived = selectDerived(doc);
      const part = derived.ok ? derived.model.parts.find((p) => p.id === id) : undefined;
      return part ? t(`role.${part.role}`) : id;
    }
    default:
      return t('target.design');
  }
}

/** Collapsible list of errors and warnings; activating an entry selects its target and focuses the field (AC-024). */
export function ValidationPanel({ doc }: { doc: DesignDocument }) {
  const { t, locale } = useT();
  const { editor } = useApp();
  const [open, setOpen] = useState(true);
  const derived = selectDerived(doc);
  const issues = derived.ok ? derived.model.issues : derived.issues;
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;

  const activate = (issue: ValidationIssue) => {
    const { selection, fieldId } = issueNavigation(doc, derived.ok ? derived.model : null, issue);
    const state = editor.getState();
    state.select(selection);
    if (fieldId) state.requestFocus(fieldId);
  };

  return (
    <section className="validation-panel" aria-labelledby="validation-heading">
      <div className="validation-header">
        <h2 id="validation-heading" className="panel-heading">
          {t('validation.heading')}
        </h2>
        <span role="status" aria-live="polite" data-testid="validation-counts">
          {t('issues.errors', { count: errors })} · {t('issues.warnings', { count: warnings })}
        </span>
        <button type="button" aria-expanded={open} aria-controls="validation-list" onClick={() => setOpen(!open)}>
          {t('validation.toggle')}
        </button>
      </div>
      {open && (
        <div id="validation-list">
          {issues.length === 0 ? (
            <p>{t('validation.none')}</p>
          ) : (
            <ul className="validation-list">
              {issues.map((issue, index) => (
                <li key={`${issue.code}-${issue.target.id}-${issue.target.field ?? ''}-${String(index)}`}>
                  <button
                    type="button"
                    className={`issue issue-${issue.severity}`}
                    data-code={issue.code}
                    onClick={() => activate(issue)}
                  >
                    <span className="issue-severity">
                      {issue.severity === 'error' ? '✕ ' : '⚠ '}
                      {t(issue.severity === 'error' ? 'validation.error' : 'validation.warning')}
                    </span>
                    <span className="issue-target">{targetLabel(doc, issue, t)}</span>
                    <span className="issue-text">
                      {translateRef(locale, { key: `issue.${issue.code}`, params: issue.params })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
