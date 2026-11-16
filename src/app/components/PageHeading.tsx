import { useT } from '@/i18n/useT';

/** Sticky page title with a round back arrow to the main menu (settings, imprint). */
export function PageHeading({ title }: { title: string }) {
  const { t } = useT();
  const label = t('nav.backToMenu');
  return (
    <div className="page-heading">
      <a className="back-link" href="#/" aria-label={label} title={label}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </a>
      <h2>{title}</h2>
    </div>
  );
}
