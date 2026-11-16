import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useT } from '@/i18n/useT';

export interface MessageDialogProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  onClose: () => void;
}

/** Modal message with a single Close button; Escape closes. */
export function MessageDialog({ open, title, children, onClose }: MessageDialogProps) {
  const { t } = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      closeRef.current?.focus();
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      <div className="dialog-body">{children}</div>
      <div className="dialog-actions">
        <button ref={closeRef} type="button" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </dialog>
  );
}
