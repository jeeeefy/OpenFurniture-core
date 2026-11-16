import { useEffect, useRef, useState } from 'react';
import { localizeName } from '@/i18n';
import { useT } from '@/i18n/useT';
import { createAutosave, flushOnHidden, retryOnOnline, type Autosave } from '@/persistence/autosave';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Inspector } from '../components/inspector/Inspector';
import { Outline } from '../components/Outline';
import { SaveStatus } from '../components/SaveStatus';
import { UndoRedo } from '../components/UndoRedo';
import { ValidationPanel } from '../components/ValidationPanel';
import { Viewport } from '../components/Viewport';
import { useApp, useEditor } from '../context';
import { downloadDesign } from '../download';
import { selectDerived } from '../store/selectors';
import { renameDesign, type DesignDocument } from '@/domain';

type LoadState = 'loading' | 'ready' | 'not-found' | 'damaged';

function requestPersistence() {
  void navigator.storage.persist().catch(() => undefined);
}

function OutputsLink({ doc }: { doc: DesignDocument }) {
  const { t } = useT();
  const { routes } = useApp();
  const derived = selectDerived(doc);
  const issues = derived.ok ? derived.model.issues : derived.issues;
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;
  return (
    <a className="button outputs-link" href={routes.outputs(doc.id, 'cut-list')}>
      {t('outputs.open')}
      <span className={errors > 0 ? 'badge badge-error' : 'badge'}>
        {t('issues.errors', { count: errors })}, {t('issues.warnings', { count: warnings })}
      </span>
    </a>
  );
}

/** Clicking the title opens an inline field; the change is a normal undoable edit. */
function DesignNameField({ doc }: { doc: DesignDocument }) {
  const { t, locale } = useT();
  const { editor } = useApp();
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) {
    const displayName = localizeName(locale, doc.name);
    return (
      <>
        <h2 className="editor-name">
          <button
            type="button"
            className="editor-name-button"
            title={t('common.rename')}
            aria-describedby="editor-name-hint"
            onClick={() => setDraft(doc.name)}
          >
            {displayName}
            <span className="editor-name-pencil" aria-hidden="true">
              ✎
            </span>
          </button>
        </h2>
        <span id="editor-name-hint" className="visually-hidden">
          {t('common.rename')}
        </span>
      </>
    );
  }

  const commit = () => {
    if (draft.trim() === '') return;
    const result = editor.getState().commit(renameDesign, { name: draft });
    if (result.ok) setDraft(null);
  };

  return (
    <form
      className="editor-rename"
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
    >
      <label className="visually-hidden" htmlFor="editor-name-input">
        {t('editor.designName')}
      </label>
      <input
        id="editor-name-input"
        value={draft}
        maxLength={80}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            setDraft(null);
          }
        }}
      />
      <button type="submit" disabled={draft.trim() === ''}>
        {t('common.save')}
      </button>
      <button type="button" onClick={() => setDraft(null)}>
        {t('common.cancel')}
      </button>
    </form>
  );
}

export function EditorPage({ designId }: { designId: string }) {
  const { t } = useT();
  const { repo, editor, newId, nowIso, routes } = useApp();
  const doc = useEditor((s) => s.doc);
  const [state, setState] = useState<LoadState>('loading');
  const autosaveRef = useRef<Autosave | null>(null);

  // RouteView keys this page by design id, so every id starts in the loading state.
  useEffect(() => {
    let cancelled = false;
    editor.getState().close();
    void repo.get(designId).then((loaded) => {
      if (cancelled) return;
      if (!loaded) setState('not-found');
      else if (loaded.status === 'damaged') setState('damaged');
      else {
        const state = editor.getState();
        state.load(loaded.document, loaded.revision);
        const pending = state.pendingTarget;
        if (pending?.designId === designId) {
          state.setPendingTarget(null);
          state.select(pending.selection);
          if (pending.fieldId) state.requestFocus(pending.fieldId);
        }
        setState('ready');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [repo, editor, designId]);

  useEffect(() => {
    if (state !== 'ready') return;
    const instance = createAutosave(
      repo,
      () => editor.getState(),
      (event) => {
        const s = editor.getState();
        if (event.status === 'saved') {
          s.markSaved(event.revision, event.doc);
          if (repo.kind === 'cloud') s.setSaveStatus('savedRemote');
        } else if (event.status === 'saving') s.setSaveStatus('saving');
        else s.setSaveStatus(event.status);
      },
      { nowIso, onFirstSave: requestPersistence },
    );
    const unsubscribe = editor.subscribe((s, prev) => {
      if (s.doc && prev.doc && s.doc !== prev.doc && s.doc.id === prev.doc.id) instance.notifyChange();
    });
    const detach = flushOnHidden(instance, document);
    const detachOnline = retryOnOnline(instance, window);
    autosaveRef.current = instance;
    return () => {
      unsubscribe();
      detach();
      detachOnline();
      void instance.flush().finally(() => {
        instance.dispose();
      });
      autosaveRef.current = null;
    };
  }, [state, repo, editor, nowIso]);

  const reload = async () => {
    const loaded = await repo.get(designId);
    if (loaded?.status === 'ok') {
      editor.getState().load(loaded.document, loaded.revision);
      autosaveRef.current?.resume();
    }
  };

  const saveAsCopy = async () => {
    const current = editor.getState().doc;
    if (!current) return;
    const copy = { ...current, id: newId(), name: t('start.copyName', { name: current.name }).slice(0, 80), updatedAt: nowIso() };
    await repo.create(copy);
    window.location.hash = routes.editor(copy.id);
  };

  if (state === 'loading') return <main className="editor-message">{t('editor.loading')}</main>;
  if (state !== 'ready' || !doc) {
    return (
      <main className="editor-message">
        <h2>{state === 'damaged' ? t('editor.damaged') : t('editor.notFound')}</h2>
        {state === 'not-found' && <p>{t('editor.notFoundBody')}</p>}
        <a href={routes.start()}>{t('nav.designs')}</a>
      </main>
    );
  }

  return (
    <div className="editor">
      <div className="editor-bar">
        <a href={routes.start()} className="button">
          {t('nav.designs')}
        </a>
        <DesignNameField doc={doc} />
        <UndoRedo />
        <OutputsLink doc={doc} />
        <button type="button" onClick={() => downloadDesign(doc)}>
          {t('common.export')}
        </button>
        <SaveStatus onReload={() => void reload()} onSaveAsCopy={() => void saveAsCopy()} onExport={() => downloadDesign(doc)} />
      </div>
      <p className="small-screen-notice">{t('editor.smallScreen')}</p>
      <nav className="editor-outline" aria-label={t('editor.outline')}>
        <h2 className="panel-heading">{t('editor.outline')}</h2>
        <Outline doc={doc} />
      </nav>
      <main className="editor-viewport">
        <ErrorBoundary>
          <Viewport />
        </ErrorBoundary>
      </main>
      <aside className="editor-inspector" aria-label={t('editor.inspector')}>
        <h2 className="panel-heading">{t('editor.inspector')}</h2>
        <Inspector doc={doc} />
      </aside>
      <div className="editor-validation">
        <ValidationPanel doc={doc} />
      </div>
    </div>
  );
}
