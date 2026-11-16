import { useT } from '@/i18n/useT';
import { isAppPath } from '../router';

export function NotFoundPage() {
  const { t } = useT();
  // On an unknown real path the hash link would keep that path; go to the app base instead.
  const href = isAppPath(window.location.pathname) ? '#/' : import.meta.env.BASE_URL;
  return (
    <main className="editor-message">
      <h2>{t('notFound.heading')}</h2>
      <a href={href}>{t('notFound.link')}</a>
    </main>
  );
}
