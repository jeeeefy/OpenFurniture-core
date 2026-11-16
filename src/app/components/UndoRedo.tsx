import { useEffect } from 'react';
import { useT } from '@/i18n/useT';
import { useApp, useEditor } from '../context';

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);

function isTextTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(target.type);
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === 'TEXTAREA';
}

/** Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z and Ctrl+Y redo; text fields keep their own undo (plan §6.6). */
export function useHistoryShortcuts(): void {
  const { editor } = useApp();
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || isTextTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        editor.getState().undo();
      } else if ((key === 'z' && e.shiftKey) || (key === 'y' && e.ctrlKey && !e.shiftKey)) {
        e.preventDefault();
        editor.getState().redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [editor]);
}

function HistoryArrow({ direction }: { direction: 'back' | 'forward' }) {
  const undo = direction === 'back';
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d={undo ? 'M3 10h11a5 5 0 0 1 0 10h-4' : 'M21 10H10a5 5 0 0 0 0 10h4'} />
      <path d={undo ? 'M7 6l-4 4 4 4' : 'M17 6l4 4-4 4'} />
    </svg>
  );
}

export function UndoRedo() {
  const { t } = useT();
  const { editor } = useApp();
  const canUndo = useEditor((s) => s.history.past.length > 0);
  const canRedo = useEditor((s) => s.history.future.length > 0);
  useHistoryShortcuts();
  return (
    <span className="button-row">
      <button
        type="button"
        className="icon-button"
        title={t('history.undo')}
        aria-label={t('history.undo')}
        disabled={!canUndo}
        aria-keyshortcuts="Control+Z Meta+Z"
        onClick={() => editor.getState().undo()}
      >
        <HistoryArrow direction="back" />
      </button>
      <button
        type="button"
        className="icon-button"
        title={t('history.redo')}
        aria-label={t('history.redo')}
        disabled={!canRedo}
        aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
        onClick={() => editor.getState().redo()}
      >
        <HistoryArrow direction="forward" />
      </button>
    </span>
  );
}
