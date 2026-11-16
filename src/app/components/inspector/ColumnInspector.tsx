import { useState } from 'react';
import { addColumn, LIMITS, removeColumn, setColumnWidth, type Column, type DesignDocument } from '@/domain';
import { useT } from '@/i18n/useT';
import { useApp } from '../../context';
import { selectDerived } from '../../store/selectors';
import { ConfirmDialog } from '../ConfirmDialog';
import { SizeSpecField } from '../SizeSpecField';

function isEmptyColumn(column: Column): boolean {
  return (
    column.sections.length === 1 &&
    column.sections.every((s) => s.interior.kind === 'empty' && s.front.kind === 'none')
  );
}

export function ColumnInspector({ doc, columnId }: { doc: DesignDocument; columnId: string }) {
  const { t } = useT();
  const { editor, newId } = useApp();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const index = doc.layout.columns.findIndex((c) => c.id === columnId);
  const column = doc.layout.columns[index];
  if (!column) return null;
  const derived = selectDerived(doc);
  const resolved = derived.ok ? derived.model.layout.columns[index]?.widthMm ?? null : null;
  const { commit, select } = editor.getState();
  const canAdd = doc.layout.columns.length < LIMITS.columns.max;

  const add = (atIndex: number) => {
    const columnIdNew = newId();
    const result = commit(addColumn, { atIndex, columnId: columnIdNew, sectionId: newId() });
    if (result.ok) select({ kind: 'column', id: columnIdNew });
  };

  const remove = () => {
    setConfirmRemove(false);
    const result = commit(removeColumn, { columnId });
    if (result.ok) select(null);
  };

  return (
    <div className="inspector-form">
      <h3>{t('column.heading', { n: index + 1 })}</h3>
      <SizeSpecField
        fieldId="field-column-width"
        legend={t('column.widthMode')}
        label={t('column.width')}
        spec={column.width}
        resolvedMm={resolved}
        min={doc.construction.minColumnClearWidthMm}
        max={LIMITS.widthMm.max}
        onCommit={(width) => commit(setColumnWidth, { columnId, width })}
      />
      <div className="button-stack">
        <button type="button" disabled={!canAdd} onClick={() => add(index)}>
          {t('column.addLeft')}
        </button>
        <button type="button" disabled={!canAdd} onClick={() => add(index + 1)}>
          {t('column.addRight')}
        </button>
        <button
          type="button"
          className="danger"
          disabled={doc.layout.columns.length <= 1}
          onClick={() => (isEmptyColumn(column) ? remove() : setConfirmRemove(true))}
        >
          {t('column.remove')}
        </button>
      </div>
      <ConfirmDialog
        open={confirmRemove}
        title={t('column.removeTitle', { n: index + 1 })}
        confirmLabel={t('column.remove')}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={remove}
      >
        <p>{t('column.removeBody', { sections: column.sections.length })}</p>
      </ConfirmDialog>
    </div>
  );
}
