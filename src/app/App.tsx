import './styles.css';
import './print.css';
import { useEffect, useMemo, useState } from 'react';
import type { Locale } from '@/domain';
import { I18nProvider, useT } from '@/i18n/useT';
import { openDatabase } from '@/persistence/designRepository';
import { browserStorage, loadSettings, saveSettings } from '@/persistence/settings';
import type { DesignRepository } from '@/persistence/types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppContext, type AppServices } from './context';
import { ExtensionContext, useExtension } from './extension/context';
import { loadExtension } from './extension/loadExtension';
import type { AppExtension } from './extension/types';
import { fdLinks, LinkList } from './links';
import { coreRoutes, isAppPath, useRoute, type Route } from './router';
import { EditorPage } from './routes/EditorPage';
import { ImprintPage } from './routes/ImprintPage';
import { NotFoundPage } from './routes/NotFoundPage';
import { OutputsPage } from './routes/OutputsPage';
import { PrintPage } from './routes/PrintPage';
import { SettingsPage } from './routes/SettingsPage';
import { StartPage } from './routes/StartPage';
import { createEditorStore } from './store/editorStore';

function Header({ locale, onLocaleChange }: { locale: Locale; onLocaleChange: (l: Locale) => void }) {
  const { t } = useT();
  const extension = useExtension();
  return (
    <header className="app-header">
      <h1 className="app-logo">
        <a href={coreRoutes().start()} title={t('app.title')}>
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt={t('app.title')} width={36} height={36} />
        </a>
      </h1>
      <nav className="app-nav">
        {fdLinks().header.map((link) => {
          if (link.key === 'account' && extension?.HeaderMenu) {
            const Menu = extension.HeaderMenu;
            return <Menu key={link.key} />;
          }
          return (
            <a key={link.key} href={link.href}>
              {t(`links.${link.key}`)}
            </a>
          );
        })}
        <a href="#/settings">{t('nav.settings')}</a>
        <select
          aria-label={t('settings.language')}
          value={locale}
          onChange={(e) => {
            onLocaleChange(e.target.value === 'de' ? 'de' : 'en');
          }}
        >
          <option value="en">EN</option>
          <option value="de">DE</option>
        </select>
      </nav>
    </header>
  );
}

function Footer() {
  const links = fdLinks().footer;
  if (links.length === 0) return null;
  return (
    <footer className="app-footer">
      <LinkList links={links} />
    </footer>
  );
}

function ExtRoute({ route }: { route: Extract<Route, { name: 'ext' }> }) {
  const extension = useExtension();
  return <>{extension?.route(route.path, new URLSearchParams(route.query)) ?? <NotFoundPage />}</>;
}

function RouteView({ route }: { route: Route }) {
  switch (route.name) {
    case 'start':
      return <StartPage />;
    case 'editor':
      return <EditorPage key={route.designId} designId={route.designId} />;
    case 'settings':
      return <SettingsPage />;
    case 'imprint':
      return <ImprintPage />;
    case 'outputs':
      return <OutputsPage key={route.designId} designId={route.designId} tab={route.tab} />;
    case 'print':
      return <PrintPage key={route.designId} designId={route.designId} />;
    case 'ext':
      return <ExtRoute route={route} />;
    case 'not-found':
      return <NotFoundPage />;
  }
}

function MemoryBanner() {
  const { t } = useT();
  return (
    <p className="banner" role="alert" data-testid="memory-banner">
      {t('storage.memoryOnly')}
    </p>
  );
}

export function App() {
  const [locale, setLocaleState] = useState<Locale>(() => loadSettings(browserStorage(), navigator.language).locale);
  const [repo, setRepo] = useState<DesignRepository | null>(null);
  const [editor] = useState(createEditorStore);
  const [extension, setExtension] = useState<AppExtension | null>(null);
  const route = useRoute();
  // Hosts with SPA fallback return this page for unknown paths; show not-found
  // instead of the start page in that case.
  const viewRoute: Route = isAppPath(window.location.pathname) ? route : { name: 'not-found' };

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    void openDatabase().then(setRepo);
  }, []);

  useEffect(() => {
    const marker = typeof localStorage !== 'undefined' && localStorage.getItem('fd.account') === '1';
    if (route.name === 'ext' || marker) {
      void loadExtension().then(setExtension);
    }
  }, [route.name]);

  const services = useMemo<AppServices | null>(
    () =>
      repo && {
        repo,
        editor,
        locale,
        setLocale: (next) => {
          setLocaleState(next);
          saveSettings(browserStorage(), { locale: next });
        },
        newId: () => crypto.randomUUID(),
        nowIso: () => new Date().toISOString(),
        routes: coreRoutes(),
      },
    [repo, editor, locale],
  );

  return (
    <I18nProvider locale={locale}>
      <ExtensionContext.Provider value={extension}>
        <Header locale={locale} onLocaleChange={(next) => services?.setLocale(next)} />
        {services ? (
          <AppContext.Provider value={services}>
            {repo?.kind === 'memory' && <MemoryBanner />}
            <ErrorBoundary>
              <RouteView route={viewRoute} />
            </ErrorBoundary>
          </AppContext.Provider>
        ) : null}
        <Footer />
      </ExtensionContext.Provider>
    </I18nProvider>
  );
}
