import type { DesignDocument, DrillingPlan, PositionGroup } from '@/domain';
import { useT } from '@/i18n/useT';
import { DrillingPlanSvg } from './DrillingPlanSvg';

function Legend() {
  const { t } = useT();
  return (
    <section className="drilling-legend" aria-labelledby="drilling-legend-heading">
      <h3 id="drilling-legend-heading">{t('drilling.legend')}</h3>
      <ul>
        <li>{t('drilling.legendHole')}</li>
        <li>{t('drilling.legendThrough')}</li>
        <li>{t('drilling.legendCountersink')}</li>
        <li>{t('drilling.legendMark')}</li>
        <li>{t('drilling.legendBanded')}</li>
        <li>{t('drilling.legendOrigin')}</li>
      </ul>
      <p className="hint">{t('drilling.pilotNote')}</p>
    </section>
  );
}

function PlanView({ doc, plan, group }: { doc: DesignDocument; plan: DrillingPlan; group: PositionGroup | undefined }) {
  const { t, formatMm } = useT();
  const name = t(`role.${plan.role}`);
  const material = doc.materials.find((m) => m.id === group?.materialId)?.name ?? '';
  return (
    <article className="drilling-plan" data-position={plan.position}>
      <header className="drilling-plan-head">
        <h3>{t('drilling.title', { position: plan.position, name, quantity: plan.quantity })}</h3>
        <p>{t('drilling.size', { l: plan.lengthMm, w: plan.widthMm, t: plan.thicknessMm, material })}</p>
        {plan.unverifiedProfiles.length > 0 && (
          <p className="banner drilling-banner" role="note" data-testid="unverified-banner">
            ⚠ {t('drilling.banner')} ({plan.unverifiedProfiles.join(', ')})
          </p>
        )}
      </header>
      {plan.faces.map((face) => (
        <section key={face.face} className="drilling-face" data-face={face.face}>
          <h4>{t('drilling.viewLabel', { face: t(`face.${face.semantic}`) })}</h4>
          <DrillingPlanSvg plan={plan} face={face} partName={name} />
          <table className="data-table hole-table">
            <thead>
              <tr>
                <th scope="col">{t('drilling.ref')}</th>
                <th scope="col">{t('drilling.x')}</th>
                <th scope="col">{t('drilling.y')}</th>
                <th scope="col">{t('drilling.diameter')}</th>
                <th scope="col">{t('drilling.depth')}</th>
                <th scope="col">{t('drilling.countersink')}</th>
                <th scope="col">{t('drilling.purpose')}</th>
              </tr>
            </thead>
            <tbody>
              {face.holes.map((h) => (
                <tr key={h.ref} data-ref={h.ref}>
                  <td>{h.ref}</td>
                  <td>{formatMm(h.xMm)}</td>
                  <td>{formatMm(h.yMm)}</td>
                  <td>{formatMm(h.diameterMm)}</td>
                  <td>{h.depth === 'through' ? t('drilling.through') : formatMm(h.depth)}</td>
                  <td>{h.countersinkDiameterMm === null ? '—' : formatMm(h.countersinkDiameterMm)}</td>
                  <td>{t(`purpose.${h.purpose}`)}</td>
                </tr>
              ))}
              {face.marks.map((m) => (
                <tr key={m.ref} data-ref={m.ref}>
                  <td>{m.ref}</td>
                  <td>{formatMm(m.xMm)}</td>
                  <td>{formatMm(m.yMm)}</td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td>{t(`purpose.${m.purpose}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </article>
  );
}

export function DrillingPlans({ doc, plans, positions }: { doc: DesignDocument; plans: DrillingPlan[]; positions: PositionGroup[] }) {
  const { t } = useT();
  if (plans.length === 0) return <p>{t('drilling.none')}</p>;
  return (
    <div className="drilling-plans">
      <Legend />
      {plans.map((plan) => (
        <PlanView key={plan.position} doc={doc} plan={plan} group={positions.find((p) => p.position === plan.position)} />
      ))}
    </div>
  );
}
