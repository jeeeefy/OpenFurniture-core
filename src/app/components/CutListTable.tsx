import type { CutListGroup, DesignDocument, HardwareListRow, MaterialLayout } from '@/domain';
import { localizeName } from '@/i18n';
import { useT } from '@/i18n/useT';
import { MaterialAreas } from './MaterialAreas';

export function CutListTable({
  doc,
  cutList,
  hardware,
  layouts = [],
  showAreas = true,
}: {
  doc: DesignDocument;
  cutList: CutListGroup[];
  hardware: HardwareListRow[];
  layouts?: readonly MaterialLayout[];
  showAreas?: boolean;
}) {
  const { t, formatMm, locale } = useT();
  const size = (...values: number[]) => values.map(formatMm).join(' × ');
  const bands = hardware.filter((row) => row.kind === 'edge-band');

  return (
    <div className="cut-list">
      {cutList.map((group) => {
        const material = doc.materials.find((m) => m.id === group.materialId);
        if (!material) return null;
        return (
          <table key={group.materialId} className="data-table" data-material={group.materialId}>
            <caption>
              {t('cutList.caption', {
                name: material.name,
                thicknessMm: material.thicknessMm,
                sheetL: material.sheet.lengthMm,
                sheetW: material.sheet.widthMm,
                grain: material.hasGrain,
              })}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t('cutList.pos')}</th>
                <th scope="col">{t('cutList.part')}</th>
                <th scope="col">{t('cutList.qty')}</th>
                <th scope="col">{t('cutList.finished')}</th>
                <th scope="col">{t('cutList.cut')}</th>
                <th scope="col">{t('cutList.grain')}</th>
                <th scope="col">{t('cutList.banding')}</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row) => {
                const sameCut = row.cut.lengthMm === row.finished.lengthMm && row.cut.widthMm === row.finished.widthMm;
                return (
                  <tr key={row.position} data-position={row.position}>
                    <td>{row.position}</td>
                    <td>{t(`role.${row.role}`)}</td>
                    <td>{row.quantity}</td>
                    <td>{size(row.finished.lengthMm, row.finished.widthMm, row.finished.thicknessMm)}</td>
                    <td>{sameCut ? t('cutList.sameAsFinished') : size(row.cut.lengthMm, row.cut.widthMm)}</td>
                    <td>{row.grain === 'length' ? t('cutList.grainAlong') : '—'}</td>
                    <td>{t('cutList.bandingValue', { l: row.bandedEdges.v, w: row.bandedEdges.u })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        );
      })}
      {showAreas && <MaterialAreas doc={doc} cutList={cutList} layouts={layouts} />}
      {bands.length > 0 && (
        <section>
          <h3>{t('cutList.edgeBandTotals')}</h3>
          <ul data-testid="edge-band-totals">
            {bands.map((row) => {
              const material = doc.materials.find((m) => row.key === `edge-band:${m.id}`);
              return (
                <li key={row.key}>
                  {localizeName(locale, material?.name ?? '')}: {formatMm(row.quantity)} {t('unit.m')}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
