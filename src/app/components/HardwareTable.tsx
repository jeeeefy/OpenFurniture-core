import type { HardwareListRow } from '@/domain';
import { translateRef } from '@/i18n';
import { useT } from '@/i18n/useT';

export function HardwareTable({ rows }: { rows: HardwareListRow[] }) {
  const { t, locale, formatMm } = useT();
  if (rows.length === 0) return <p>{t('hardwareTable.empty')}</p>;
  return (
    <table className="data-table hardware-table">
      <thead>
        <tr>
          <th scope="col">{t('hardwareTable.item')}</th>
          <th scope="col">{t('hardwareTable.quantity')}</th>
          <th scope="col">{t('hardwareTable.usedOn')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} data-key={row.key}>
            <td>
              {translateRef(locale, row.label)}
              {row.verified === false && <span className="tag tag-warning">{t('hardwareTable.unverified')}</span>}
            </td>
            <td>
              {formatMm(row.quantity)} {t(`unit.${row.unit}`)}
              {row.spareIncluded > 0 && <span className="hint"> ({t('hardwareTable.spare', { count: row.spareIncluded })})</span>}
            </td>
            <td>{row.positions.length > 0 ? t('hardwareTable.positions', { list: row.positions.join(', ') }) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
