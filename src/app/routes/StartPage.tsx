import { useEffect, useState } from 'react';
import { createDesign, TEMPLATE_IDS, templateNameRef, type TemplateId } from '@/domain';
import { localizeName, translateRef } from '@/i18n';
import { useT } from '@/i18n/useT';
import { importDesignFile, type ImportError } from '@/persistence/fileFormat';
import type { DesignSummary } from '@/persistence/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MessageDialog } from '../components/MessageDialog';
import { useApp } from '../context';
import { downloadDesign, downloadRaw } from '../download';

/** Small front-view sketch of each template (decorative). */
function TemplateIcon({ id }: { id: TemplateId }) {
  const lines: Record<TemplateId, string> = {
    bookcase: 'M24 4v40M4 14h20M4 24h40M4 34h20M24 17h20M24 31h20',
    cabinet: 'M24 4v40M20 20v8M28 20v8',
    sideboard: 'M17 4v40M31 4v40M17 17h14M17 30h14',
    chest: 'M4 14h40M4 24h40M4 34h40M20 9h8M20 19h8M20 29h8M20 39h8',
    wardrobe: 'M17 4v40M31 4v40M4 12h13M31 14h13',
    blank: '',
  };
  return (
    <svg className="template-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="40" height="40" rx="2" />
      {lines[id] && <path d={lines[id]} />}
    </svg>
  );
}

function TemplateCard({ id, onCreate }: { id: TemplateId; onCreate: (id: TemplateId) => void }) {
  const { t, locale } = useT();
  return (
    <li className="template-card">
      <button type="button" data-template={id} onClick={() => onCreate(id)}>
        <TemplateIcon id={id} />
        <span className="template-name">{translateRef(locale, templateNameRef(id))}</span>
        <span className="template-info">{t(`templateInfo.${id}`)}</span>
      </button>
    </li>
  );
}

function RenameForm({ summary, onDone }: { summary: DesignSummary; onDone: (name: string | null) => void }) {
  const { t } = useT();
  const [name, setName] = useState(summary.name);
  return (
    <form
      className="rename-form"
      onSubmit={(e) => {
        e.preventDefault();
        onDone(name);
      }}
    >
      <label>
        {t('start.renameLabel', { name: summary.name })}
        <input
          value={name}
          maxLength={80}
          autoFocus
          onChange={(e) => {
            setName(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onDone(null);
          }}
        />
      </label>
      <button type="submit">{t('common.save')}</button>
      <button type="button" onClick={() => onDone(null)}>
        {t('common.cancel')}
      </button>
    </form>
  );
}

function ImportErrorText({ error }: { error: ImportError }) {
  const { t } = useT();
  return (
    <>
      <p data-testid="import-error" data-code={error.code}>
        {error.code === 'NEWER_VERSION'
          ? t('import.NEWER_VERSION', { fileVersion: error.fileVersion ?? 0, supportedVersion: error.supportedVersion ?? 0 })
          : t(`import.${error.code}`)}
      </p>
      {error.details.length > 0 && (
        <ul>
          {error.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
      <p>{t('import.nothingChanged')}</p>
    </>
  );
}

export function StartPage() {
  const { t, locale, formatDate } = useT();
  const { repo, newId, nowIso, routes } = useApp();
  const [designs, setDesigns] = useState<DesignSummary[] | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<DesignSummary | null>(null);
  const [importError, setImportError] = useState<ImportError | null>(null);

  const refresh = () => {
    void repo.list().then(setDesigns);
  };
  useEffect(refresh, [repo]);

  const create = async (template: TemplateId) => {
    const doc = createDesign(template, newId, nowIso(), translateRef(locale, templateNameRef(template)));
    await repo.create(doc);
    window.location.hash = routes.editor(doc.id);
  };

  const importFile = async (file: File) => {
    const existing = await repo.list();
    const result = await importDesignFile(file, {
      existingNames: new Set(existing.map((d) => d.name)),
      newId: newId(),
      nowIso: nowIso(),
    });
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    await repo.create(result.doc);
    window.location.hash = routes.editor(result.doc.id);
  };

  const exportDesign = async (summary: DesignSummary) => {
    const loaded = await repo.get(summary.id);
    if (loaded?.status === 'ok') downloadDesign(loaded.document);
    else if (loaded) downloadRaw(summary.name, loaded.raw);
  };

  return (
    <main className="start-page">
      <p className="start-intro">{t('start.intro')}</p>
      <section aria-labelledby="new-heading">
        <h2 id="new-heading">{t('start.newDesign')}</h2>
        <ul className="template-grid">
          {TEMPLATE_IDS.map((id) => (
            <TemplateCard key={id} id={id} onCreate={(tid) => void create(tid)} />
          ))}
        </ul>
        <label className="button file-button">
          {t('start.import')}
          <input
            type="file"
            accept=".json,application/json"
            className="visually-hidden"
            data-testid="import-input"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              e.target.value = '';
              if (selected) void importFile(selected);
            }}
          />
        </label>
      </section>

      <section aria-labelledby="designs-heading">
        <h2 id="designs-heading">{t('start.yourDesigns')}</h2>
        {designs === null && <p>{t('start.loading')}</p>}
        {designs?.length === 0 && <p className="empty-state">{t('start.empty')}</p>}
        {designs && designs.length > 0 && (
          <ul className="design-list">
            {designs.map((d) => (
              <li key={d.id} className="design-item" data-design-id={d.id}>
                {renaming === d.id ? (
                  <RenameForm
                    summary={d}
                    onDone={(name) => {
                      setRenaming(null);
                      if (name !== null && name.trim() !== '' && name.trim() !== d.name) {
                        void repo.rename(d.id, name, d.revision).then(refresh, refresh);
                      }
                    }}
                  />
                ) : (
                  <>
                    <div className="design-meta">
                      <span className="design-name">{localizeName(locale, d.name)}</span>
                      <span className="design-date">
                        {d.damaged ? t('start.damaged') : t('start.lastChanged', { date: d.updatedAt ? formatDate(d.updatedAt) : '–' })}
                      </span>
                    </div>
                    <div className="button-row" role="group" aria-label={t('start.actionsFor', { name: d.name })}>
                      {!d.damaged && (
                        <>
                          <a className="button primary" href={routes.editor(d.id)}>
                            {t('common.open')}
                          </a>
                          <button type="button" onClick={() => setRenaming(d.id)}>
                            {t('common.rename')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void repo
                                .duplicate(d.id, { newId: newId(), nowIso: nowIso(), name: t('start.copyName', { name: d.name }) })
                                .then(refresh, refresh);
                            }}
                          >
                            {t('common.duplicate')}
                          </button>
                        </>
                      )}
                      <button type="button" onClick={() => void exportDesign(d)}>
                        {d.damaged ? t('start.exportRaw') : t('common.export')}
                      </button>
                      <button type="button" className="danger" onClick={() => setDeleting(d)}>
                        {t('common.delete')}
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? t('start.deleteTitle', { name: deleting.name }) : ''}
        confirmLabel={t('common.delete')}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (target) void repo.remove(target.id).then(refresh, refresh);
        }}
      >
        <p>{t('start.deleteBody')}</p>
      </ConfirmDialog>

      <MessageDialog open={importError !== null} title={t('import.title')} onClose={() => setImportError(null)}>
        {importError && <ImportErrorText error={importError} />}
      </MessageDialog>
    </main>
  );
}
