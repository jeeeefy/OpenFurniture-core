import { LIMITS, setDrawerFrontHeight, type DesignDocument } from '@/domain';
import { useT } from '@/i18n/useT';
import { useApp } from '../../context';
import { selectDerived } from '../../store/selectors';
import { SizeSpecField } from '../SizeSpecField';

export function DrawerInspector({ doc, drawerId }: { doc: DesignDocument; drawerId: string }) {
  const { t } = useT();
  const { editor } = useApp();
  for (const [ci, column] of doc.layout.columns.entries()) {
    for (const [si, section] of column.sections.entries()) {
      if (section.front.kind !== 'drawers') continue;
      const di = section.front.drawers.findIndex((d) => d.id === drawerId);
      const drawer = section.front.drawers[di];
      if (!drawer) continue;
      const derived = selectDerived(doc);
      const resolved = derived.ok ? derived.model.parts.find((p) => p.id === `drw:${drawerId}:front`)?.widthMm ?? null : null;
      return (
        <div className="inspector-form">
          <h3>{t('drawer.heading', { column: ci + 1, section: si + 1, drawer: di + 1 })}</h3>
          <SizeSpecField
            fieldId="field-drawer-frontHeight"
            legend={t('drawer.frontHeight')}
            label={t('drawer.frontHeight')}
            spec={drawer.frontHeight}
            resolvedMm={resolved}
            min={1}
            max={LIMITS.heightMm.max}
            onCommit={(frontHeight) => editor.getState().commit(setDrawerFrontHeight, { drawerId, frontHeight })}
          />
        </div>
      );
    }
  }
  return null;
}
