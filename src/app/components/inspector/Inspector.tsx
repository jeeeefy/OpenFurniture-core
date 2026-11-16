import { useEffect, useRef, type RefObject } from 'react';
import type { DesignDocument } from '@/domain';
import { useT } from '@/i18n/useT';
import { useEditor } from '../../context';
import { CarcassInspector } from './CarcassInspector';
import { ColumnInspector } from './ColumnInspector';
import { DrawerInspector } from './DrawerInspector';
import { HardwareInspector } from './HardwareInspector';
import { MaterialsInspector } from './MaterialsInspector';
import { SectionInspector } from './SectionInspector';
import { BandingInspector } from './BandingInspector';

const FOCUSABLE = 'input:not([disabled]), select:not([disabled]), button:not([disabled]), textarea';

/** Focuses the requested field, or its first focusable child when the id belongs to a fieldset. */
function useFocusRequest(container: RefObject<HTMLDivElement | null>) {
  const request = useEditor((s) => s.focusRequest);
  useEffect(() => {
    if (!request) return;
    const target = document.getElementById(request.fieldId);
    if (target instanceof HTMLDetailsElement) target.open = true;
    const card = target?.parentElement?.closest('details');
    if (card) card.open = true;
    const focusable = target?.matches(FOCUSABLE) ? target : target?.querySelector<HTMLElement>(FOCUSABLE);
    (focusable ?? container.current?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
  }, [request, container]);
}

export function Inspector({ doc }: { doc: DesignDocument }) {
  const { t } = useT();
  const selection = useEditor((s) => s.selection);
  const ref = useRef<HTMLDivElement>(null);
  useFocusRequest(ref);

  let body;
  if (!selection) body = <p>{t('inspector.empty')}</p>;
  else if (selection.kind === 'carcass' || selection.kind === 'plinth') body = <CarcassInspector doc={doc} />;
  else if (selection.kind === 'column') body = <ColumnInspector key={selection.id} doc={doc} columnId={selection.id} />;
  else if (selection.kind === 'section') body = <SectionInspector key={selection.id} doc={doc} sectionId={selection.id} />;
  else if (selection.kind === 'drawer') body = <DrawerInspector key={selection.id} doc={doc} drawerId={selection.id} />;
  else if (selection.kind === 'materials') body = <MaterialsInspector doc={doc} />;
  else if (selection.kind === 'banding') body = <BandingInspector doc={doc} />;
  else body = <HardwareInspector doc={doc} />;

  return <div ref={ref}>{body}</div>;
}
