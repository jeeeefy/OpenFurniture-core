import { useEffect, useState } from 'react';
import { LICENCE_FILE, LICENCES } from 'virtual:licences';
import { SCHEMA_VERSION } from '@/domain';
import { useT } from '@/i18n/useT';
import { PageHeading } from '../components/PageHeading';
import { useApp } from '../context';

type Persistence = 'granted' | 'not-granted' | 'unknown';

async function queryPersistence(): Promise<Persistence> {
  if (typeof navigator.storage.persisted !== 'function') return 'unknown';
  return (await navigator.storage.persisted()) ? 'granted' : 'not-granted';
}

export function SettingsPage() {
  const { t, locale } = useT();
  const { repo, setLocale } = useApp();
  const [persistence, setPersistence] = useState<Persistence>('unknown');

  useEffect(() => {
    void queryPersistence().then(setPersistence, () => setPersistence('unknown'));
  }, []);

  return (
    <main className="settings-page">
      <PageHeading title={t('settings.heading')} />
      <section>
        <h3>{t('settings.language')}</h3>
        <select
          aria-label={t('settings.language')}
          value={locale}
          onChange={(e) => {
            setLocale(e.target.value === 'de' ? 'de' : 'en');
          }}
        >
          <option value="en">{t('settings.language.en')}</option>
          <option value="de">{t('settings.language.de')}</option>
        </select>
      </section>
      <section>
        <h3>{t('settings.storage')}</h3>
        {repo.kind === 'memory' && <p className="banner">{t('storage.memoryOnly')}</p>}
        <p>
          {persistence === 'granted'
            ? t('settings.persisted')
            : persistence === 'not-granted'
              ? t('settings.notPersisted')
              : t('settings.persistUnknown')}
        </p>
        {persistence === 'not-granted' && (
          <button
            type="button"
            onClick={() => {
              void navigator.storage
                .persist()
                .then(() => queryPersistence())
                .then(setPersistence, () => setPersistence('unknown'));
            }}
          >
            {t('settings.requestPersist')}
          </button>
        )}
      </section>
      <section>
        <h3>{t('settings.about')}</h3>
        <p>{t('settings.appVersion', { version: __APP_VERSION__ })}</p>
        <p>{t('settings.schemaVersion', { version: SCHEMA_VERSION })}</p>
      </section>
      <section aria-labelledby="legal-heading">
        <h3 id="legal-heading">{t('settings.legal')}</h3>
        <p>{t('settings.legalIntro')}</p>
        <a className="button" href="#/imprint">
          {t('nav.imprint')}
        </a>
      </section>
      <section aria-labelledby="licences-heading">
        <h3 id="licences-heading">{t('settings.licences')}</h3>
        <p>{t('settings.licencesIntro')}</p>
        <table className="data-table" data-testid="licence-list">
          <thead>
            <tr>
              <th scope="col">{t('settings.licencePackage')}</th>
              <th scope="col">{t('settings.licenceVersion')}</th>
              <th scope="col">{t('settings.licence')}</th>
            </tr>
          </thead>
          <tbody>
            {LICENCES.map((p) => (
              <tr key={`${p.name}@${p.version}`}>
                <td>{p.name}</td>
                <td>{p.version}</td>
                <td>{p.licence}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          <a href={`${import.meta.env.BASE_URL}${LICENCE_FILE}`} target="_blank" rel="noopener noreferrer">
            {t('settings.licenceTexts')}
          </a>
        </p>
      </section>
    </main>
  );
}
