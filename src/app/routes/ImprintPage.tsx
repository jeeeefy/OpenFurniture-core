import { useT } from '@/i18n/useT';
import { PageHeading } from '../components/PageHeading';
import { IMPRINT } from '../legal';

/** German provider identification (Impressum) required by § 5 DDG. */
export function ImprintPage() {
  const { t } = useT();
  return (
    <main className="legal-page">
      <PageHeading title={t('imprint.heading')} />
      <p className="start-intro">{t('imprint.intro')}</p>

      <section aria-labelledby="imprint-provider">
        <h3 id="imprint-provider">{t('imprint.providerHeading')}</h3>
        <p>
          <strong>{t('imprint.provider')}</strong>
        </p>
        <address className="imprint-address">
          {IMPRINT.name}
          <br />
          {IMPRINT.street}
          <br />
          {IMPRINT.city}
          <br />
          {t('imprint.country')}
        </address>
      </section>

      <section aria-labelledby="imprint-contact">
        <h3 id="imprint-contact">{t('imprint.contactHeading')}</h3>
        <p>
          <strong>{t('imprint.email')}:</strong> <a href={`mailto:${IMPRINT.email}`}>{IMPRINT.email}</a>
        </p>
      </section>

      <section aria-labelledby="imprint-responsible">
        <h3 id="imprint-responsible">{t('imprint.responsibleHeading')}</h3>
        <p>{t('imprint.responsibleBody')}</p>
        <address className="imprint-address">
          {IMPRINT.name}
          <br />
          {IMPRINT.street}
          <br />
          {IMPRINT.city}
        </address>
      </section>

      <section aria-labelledby="imprint-dispute">
        <h3 id="imprint-dispute">{t('imprint.disputeHeading')}</h3>
        <p>{t('imprint.disputeBody')}</p>
      </section>

      <section aria-labelledby="imprint-liability">
        <h3 id="imprint-liability">{t('imprint.liabilityHeading')}</h3>
        <p>{t('imprint.liabilityBody')}</p>
      </section>

      <section aria-labelledby="imprint-copyright">
        <h3 id="imprint-copyright">{t('imprint.copyrightHeading')}</h3>
        <p>{t('imprint.copyrightBody')}</p>
      </section>

      <p className="hint">{t('imprint.updated')}</p>
    </main>
  );
}
