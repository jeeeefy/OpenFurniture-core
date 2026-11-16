import { useT } from '@/i18n/useT';
import { useEditor } from '../context';

export interface SaveStatusProps {
  onReload: () => void;
  onSaveAsCopy: () => void;
  onExport: () => void;
}

export function SaveStatus({ onReload, onSaveAsCopy, onExport }: SaveStatusProps) {
  const { t } = useT();
  const status = useEditor((s) => s.saveStatus);
  return (
    <div className={`save-status save-status-${status}`}>
      <span role="status" aria-live="polite" data-testid="save-status">
        {t(`save.${status}`)}
      </span>
      {status === 'error' && (
        <button type="button" onClick={onExport}>
          {t('save.exportJson')}
        </button>
      )}
      {status === 'conflict' && (
        <span className="button-row">
          <button type="button" onClick={onReload}>
            {t('common.reload')}
          </button>
          <button type="button" onClick={onSaveAsCopy}>
            {t('save.saveAsCopy')}
          </button>
        </span>
      )}
      {status === 'readOnly' && (
        <span className="button-row">
          <button type="button" onClick={onExport}>
            {t('save.exportJson')}
          </button>
          <button type="button" onClick={onSaveAsCopy}>
            {t('save.saveAsLocalCopy')}
          </button>
        </span>
      )}
    </div>
  );
}
