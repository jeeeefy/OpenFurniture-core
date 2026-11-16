import {
  computePositions,
  edgeNamesFor,
  resetBandingOverrides,
  setBandingEdges,
  type DesignDocument,
  type EdgeId,
} from '@/domain';
import { useT } from '@/i18n/useT';
import { useApp } from '../../context';
import { selectDerived } from '../../store/selectors';

const EDGE_IDS: readonly EdgeId[] = ['u0', 'u1', 'v0', 'v1'];

/** L-13: per-position, per-edge banding overrides. Positions group identical parts. */
export function BandingInspector({ doc }: { doc: DesignDocument }) {
  const { t, formatMm } = useT();
  const { editor } = useApp();
  const derived = selectDerived(doc);
  if (!derived.ok) return <p>{t('banding.unavailable')}</p>;

  const positions = computePositions(doc, derived.model);
  const hasOverrides = Object.keys(doc.bandingOverrides ?? {}).length > 0;

  return (
    <div className="inspector-form banding-editor">
      <h3>{t('banding.heading')}</h3>
      <p className="hint">{t('banding.intro')}</p>
      {hasOverrides && (
        <button type="button" onClick={() => editor.getState().commit(resetBandingOverrides, {})}>
          {t('banding.reset')}
        </button>
      )}
      {doc.materials.map((material) => {
        const rows = positions.filter((p) => p.materialId === material.id);
        if (rows.length === 0) return null;
        return (
          <section key={material.id}>
            <h4>{material.name}</h4>
            {material.edgeBand === null && <p className="hint">{t('banding.noBand')}</p>}
            <ul className="banding-list">
              {rows.map((position) => {
                const selected = new Set(position.bandedEdges);
                const names = edgeNamesFor(position.role);
                const disabled = material.edgeBand === null;
                return (
                  <li key={position.position} className="banding-row" data-testid={`banding-position-${position.position}`}>
                    <span className="banding-caption">
                      {t('banding.position', {
                        position: position.position,
                        role: t(`role.${position.role}`),
                        quantity: position.quantity,
                        lengthMm: formatMm(position.finished.lengthMm),
                        widthMm: formatMm(position.finished.widthMm),
                      })}
                    </span>
                    <span className="banding-edges" role="group" aria-label={t('banding.edges')}>
                      {EDGE_IDS.map((edge) => {
                        const id = `banding-${position.position}-${edge}`;
                        return (
                          <label key={edge} htmlFor={id} className="checkbox">
                            <input
                              id={id}
                              type="checkbox"
                              checked={selected.has(edge)}
                              disabled={disabled}
                              onChange={(e) => {
                                const edges = e.target.checked
                                  ? [...new Set([...position.bandedEdges, edge])]
                                  : position.bandedEdges.filter((current) => current !== edge);
                                editor.getState().commit(setBandingEdges, { partIds: position.partIds, edges });
                              }}
                            />
                            {t(`edge.${names[edge]}`)}
                          </label>
                        );
                      })}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
