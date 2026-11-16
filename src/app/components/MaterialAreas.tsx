import { computeMaterialAreas, type CutListGroup, type DesignDocument, type MaterialLayout } from '@/domain';
import { formatArea, localizeName } from '@/i18n';
import { useT } from '@/i18n/useT';
import { boardsText } from './CuttingLayouts';

/** Area per material from the cut sizes, for estimating the price (L-01: no sheet count). */
export function MaterialAreas({
  doc,
  cutList,
  layouts,
  headingLevel = 3,
}: {
  doc: DesignDocument;
  cutList: CutListGroup[];
  layouts: readonly MaterialLayout[];
  headingLevel?: 2 | 3;
}) {
  const { t, formatMm, locale } = useT();
  const areas = computeMaterialAreas(cutList);
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const m2 = (value: number) => formatArea(locale, value);
  return (
    <section className="material-areas" aria-labelledby="material-areas-heading">
      <Heading id="material-areas-heading">{t('areas.heading')}</Heading>
      <table className="data-table" data-testid="material-areas">
        <thead>
          <tr>
            <th scope="col">{t('areas.material')}</th>
            <th scope="col">{t('areas.parts')}</th>
            <th scope="col">{t('areas.area')}</th>
            <th scope="col">{t('areas.sheet')}</th>
            <th scope="col">{t('areas.boards')}</th>
          </tr>
        </thead>
        <tbody>
          {areas.map((a) => {
            const material = doc.materials.find((m) => m.id === a.materialId);
            return (
              <tr key={a.materialId} data-material={a.materialId}>
                <td>{t('material.option', { name: localizeName(locale, material?.name ?? a.materialId), thicknessMm: material?.thicknessMm ?? 0 })}</td>
                <td>{a.parts}</td>
                <td>{m2(a.areaM2)}</td>
                <td>
                  {material
                    ? [material.sheet, ...(material.extraSheets ?? [])]
                        .map((s) =>
                          t('areas.sheetValue', {
                            l: formatMm(s.lengthMm),
                            w: formatMm(s.widthMm),
                            area: m2(Math.round((s.lengthMm * s.widthMm) / 10_000) / 100),
                          }),
                        )
                        .join(', ')
                    : '\u2014'}
                </td>
                <td data-testid="boards-needed">
                  {(() => {
                    const layout = layouts.find((l) => l.materialId === a.materialId);
                    return layout ? boardsText(layout, t, formatMm) : '\u2014';
                  })()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="hint">{t('areas.note')}</p>
    </section>
  );
}
