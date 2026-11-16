import type { DesignDocument, MaterialLayout, Outputs } from '@/domain';
import { localizeName } from '@/i18n';
import { useT, type I18n } from '@/i18n/useT';
import { useApp } from '../context';
import { MATERIALS_SELECTION } from '../store/selectors';

const percent = (value: number) => Math.round(value * 100);

/** "2 boards of 2500 × 1250 mm + 1 board of 1250 × 625 mm" (sizes in use only). */
export function boardsText(layout: MaterialLayout, t: I18n['t'], formatMm: I18n['formatMm']): string {
  return layout.sizes
    .filter((s) => s.count > 0)
    .map((s) => t('cutting.boards', { count: s.count, l: formatMm(s.lengthMm), w: formatMm(s.widthMm) }))
    .join(' + ');
}

function SheetSvg({ layout, sheetIndex, label }: { layout: MaterialLayout; sheetIndex: number; label: string }) {
  const { formatMm } = useT();
  const sheet = layout.sheets[sheetIndex];
  if (!sheet) return null;
  const { lengthMm: L, widthMm: W } = sheet;
  const trim = layout.trimMm;
  const stroke = Math.max(L, W) / 400;
  return (
    <svg className="cutting-svg" viewBox={`0 0 ${String(L)} ${String(W)}`} role="img" aria-label={label} data-sheet={sheet.index}>
      <rect x={0} y={0} width={L} height={W} className="cutting-sheet" strokeWidth={stroke} />
      {trim > 0 && (
        <rect x={trim} y={trim} width={L - 2 * trim} height={W - 2 * trim} className="cutting-trim" strokeWidth={stroke} />
      )}
      {sheet.placements.map((p) => {
        const big = Math.min(p.alongMm, p.acrossMm);
        const font = Math.max(Math.min(big * 0.3, p.alongMm / 5, 60), 8);
        const showSize = p.alongMm > font * 9 && p.acrossMm > font * 2.6;
        return (
          <g key={p.partId} data-part={p.partId}>
            <rect x={p.xMm} y={p.yMm} width={p.alongMm} height={p.acrossMm} className="cutting-part" strokeWidth={stroke} />
            <text
              x={p.xMm + p.alongMm / 2}
              y={p.yMm + p.acrossMm / 2 - (showSize ? font * 0.6 : 0)}
              fontSize={font}
              textAnchor="middle"
              dominantBaseline="middle"
              className="cutting-label"
            >
              {p.position}
            </text>
            {showSize && (
              <text
                x={p.xMm + p.alongMm / 2}
                y={p.yMm + p.acrossMm / 2 + font * 0.7}
                fontSize={font * 0.8}
                textAnchor="middle"
                dominantBaseline="middle"
                className="cutting-label"
              >
                {`${formatMm(p.alongMm)} × ${formatMm(p.acrossMm)}`}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function MaterialLayoutView({ doc, layout, onChange }: { doc: DesignDocument; layout: MaterialLayout; onChange: (() => void) | null }) {
  const { t, formatMm, locale } = useT();
  const material = doc.materials.find((m) => m.id === layout.materialId);
  const name = localizeName(locale, material?.name ?? layout.materialId);
  const count = layout.sheets.length;
  return (
    <section className="cutting-material" data-material={layout.materialId} aria-labelledby={`cutting-${layout.materialId}`}>
      <h3 id={`cutting-${layout.materialId}`}>
        {t('cutting.material', { name, thicknessMm: material?.thicknessMm ?? 0 })}
      </h3>
      <p data-testid="cutting-summary">
        {t('cutting.summary', { boards: boardsText(layout, t, formatMm), used: percent(layout.utilisation) })}{' '}
        {layout.grain ? t('cutting.grain') : t('cutting.noGrain')}
      </p>
      {onChange && (
        <button type="button" className="no-print" onClick={onChange}>
          {t('cutting.changeSheet')}
        </button>
      )}
      {layout.unplaced.length > 0 && (
        <p className="banner" role="alert" data-testid="cutting-unplaced">
          {t('cutting.unplaced', { list: [...new Set(layout.unplaced.map((u) => u.position))].join(', ') })}
        </p>
      )}
      {layout.sheets.map((sheet, i) => {
        const used = percent(sheet.usedMm2 / (sheet.lengthMm * sheet.widthMm));
        const label = t('cutting.sheet', { index: sheet.index, count, l: formatMm(sheet.lengthMm), w: formatMm(sheet.widthMm), used });
        return (
          <figure key={sheet.index} className="cutting-figure">
            <figcaption>{label}</figcaption>
            <SheetSvg layout={layout} sheetIndex={i} label={label} />
            <table className="data-table cutting-table">
              <thead>
                <tr>
                  <th scope="col">{t('cutList.pos')}</th>
                  <th scope="col">{t('cutting.size')}</th>
                  <th scope="col">{t('cutting.at')}</th>
                  <th scope="col">{t('cutting.turned')}</th>
                </tr>
              </thead>
              <tbody>
                {sheet.placements.map((p) => (
                  <tr key={p.partId}>
                    <td>{p.position}</td>
                    <td>{`${formatMm(p.alongMm)} × ${formatMm(p.acrossMm)}`}</td>
                    <td>{`${formatMm(p.xMm)} / ${formatMm(p.yMm)}`}</td>
                    <td>{p.rotated ? t('cutting.yes') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </figure>
        );
      })}
    </section>
  );
}

/** Cutting-layout tab and print section; sheet sizes, kerf and trim are edited in the editor's Materials node. */
export function CuttingLayouts({ doc, outputs, editable = true }: { doc: DesignDocument; outputs: Outputs; editable?: boolean }) {
  const { t, formatMm } = useT();
  const { editor, routes } = useApp();
  const first = outputs.cuttingLayouts[0];
  const openEditor = (fieldId: string) => () => {
    editor.getState().setPendingTarget({ designId: doc.id, selection: MATERIALS_SELECTION, fieldId });
    window.location.hash = routes.editor(doc.id);
  };
  return (
    <div className="cutting-layouts">
      <p>{t('cutting.intro')}</p>
      {first && (
        <p data-testid="cutting-settings">
          {t('cutting.settings', { kerf: formatMm(first.kerfMm), trim: formatMm(first.trimMm) })}{' '}
          {editable && (
            <button type="button" className="no-print" onClick={openEditor('field-cutting-kerf')}>
              {t('cutting.changeSettings')}
            </button>
          )}
        </p>
      )}
      {outputs.cuttingLayouts.map((layout) => (
        <MaterialLayoutView
          key={layout.materialId}
          doc={doc}
          layout={layout}
          onChange={editable ? openEditor(`field-material-${layout.materialId}-sheetLength`) : null}
        />
      ))}
      <p className="hint">{t('cutting.note')}</p>
    </div>
  );
}
