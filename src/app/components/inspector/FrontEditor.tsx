import { useState } from 'react';
import {
  coveringSection,
  DEFAULT_HANDLE_ID,
  LIMITS,
  setFront,
  setFrontSpan,
  setHandle,
  type DesignDocument,
  type Front,
  type Section,
} from '@/domain';
import { localizeName } from '@/i18n';
import { useT } from '@/i18n/useT';
import { useApp } from '../../context';
import { ConfirmDialog } from '../ConfirmDialog';

const KINDS: Front['kind'][] = ['none', 'door', 'doubleDoor', 'drawers'];
const DEFAULT_DRAWER_COUNT = 3;
const DRAWER_COUNTS = Array.from({ length: LIMITS.drawersPerSection.max }, (_, i) => i + 1);

export function FrontEditor({ doc, section }: { doc: DesignDocument; section: Section }) {
  const { t, locale } = useT();
  const { editor, newId } = useApp();
  const [pendingDrawers, setPendingDrawers] = useState<Front | null>(null);
  const { commit } = editor.getState();
  const front = section.front;
  const handleId = front.kind === 'none' ? DEFAULT_HANDLE_ID : front.handleId;
  const sections = doc.layout.columns.find((c) => c.sections.some((s) => s.id === section.id))?.sections ?? [];
  const index = sections.findIndex((s) => s.id === section.id);
  const owner = coveringSection(sections, index);
  const span = front.kind === 'door' || front.kind === 'doubleDoor' ? (front.spanSections ?? 1) : 1;
  // Spans reach upwards until the next section with its own front.
  let maxSpan = 1;
  while (index + maxSpan < sections.length && sections[index + maxSpan]?.front.kind === 'none') maxSpan += 1;
  const spanOf = (next: number) => (next > 1 ? { spanSections: next } : {});

  const apply = (next: Front, clearInterior = false) => commit(setFront, { sectionId: section.id, front: next, clearInterior });

  const drawersFront = (count: number): Front => {
    const existing = front.kind === 'drawers' ? front.drawers : [];
    const drawers = Array.from({ length: count }, (_, i) => existing[i] ?? { id: newId(), frontHeight: { mode: 'auto' as const } });
    return { kind: 'drawers', handleId, drawers };
  };

  const chooseKind = (kind: Front['kind']) => {
    if (kind === 'none') apply({ kind: 'none' });
    else if (kind === 'door') apply({ kind: 'door', hinge: front.kind === 'door' ? front.hinge : 'left', handleId, ...spanOf(span) });
    else if (kind === 'doubleDoor') apply({ kind: 'doubleDoor', handleId, ...spanOf(span) });
    else {
      const next = drawersFront(DEFAULT_DRAWER_COUNT);
      if (section.interior.kind === 'empty') apply(next);
      else setPendingDrawers(next);
    }
  };

  if (owner !== null && owner !== index) {
    return (
      <fieldset id="field-section-front">
        <legend>{t('front.heading')}</legend>
        <p className="hint" data-testid="front-covered">
          {t('front.coveredBy', { section: owner + 1 })}
        </p>
      </fieldset>
    );
  }

  return (
    <fieldset id="field-section-front">
      <legend>{t('front.heading')}</legend>
      {KINDS.map((kind) => (
        <label key={kind}>
          <input type="radio" name="section-front" checked={front.kind === kind} onChange={() => chooseKind(kind)} />
          {t(`front.kind.${kind}`)}
        </label>
      ))}

      {(front.kind === 'door' || front.kind === 'doubleDoor') && maxSpan > 1 && (
        <div className="field">
          <label htmlFor="field-section-front-span">{t('front.span')}</label>
          <select
            id="field-section-front-span"
            value={span}
            onChange={(e) => commit(setFrontSpan, { sectionId: section.id, span: Number(e.target.value) })}
          >
            {Array.from({ length: maxSpan }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      )}

      {front.kind === 'door' && (
        <div className="field" role="radiogroup" aria-label={t('front.hinge')}>
          <span>{t('front.hinge')}</span>
          {(['left', 'right'] as const).map((hinge) => (
            <label key={hinge}>
              <input
                type="radio"
                name="section-hinge"
                checked={front.hinge === hinge}
                onChange={() => apply({ ...front, hinge })}
              />
              {t(`front.hinge.${hinge}`)}
            </label>
          ))}
        </div>
      )}

      {front.kind === 'drawers' && (
        <div className="field">
          <label htmlFor="field-section-drawer-count">{t('front.drawerCount')}</label>
          <select
            id="field-section-drawer-count"
            value={front.drawers.length}
            onChange={(e) => apply(drawersFront(Number(e.target.value)))}
          >
            {DRAWER_COUNTS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      )}

      {front.kind !== 'none' && (
        <div className="field">
          <label htmlFor="field-section-handle">{t('front.handle')}</label>
          <select
            id="field-section-handle"
            value={front.handleId ?? ''}
            onChange={(e) => commit(setHandle, { sectionId: section.id, handleId: e.target.value || null })}
          >
            <option value="">{t('front.handle.none')}</option>
            {doc.hardware.handles.map((h) => (
              <option key={h.id} value={h.id}>
                {localizeName(locale, h.name)}
              </option>
            ))}
          </select>
        </div>
      )}

      <ConfirmDialog
        open={pendingDrawers !== null}
        title={t('front.toDrawersTitle')}
        confirmLabel={t('front.toDrawersConfirm')}
        onCancel={() => setPendingDrawers(null)}
        onConfirm={() => {
          if (pendingDrawers) apply(pendingDrawers, true);
          setPendingDrawers(null);
        }}
      >
        <p>{t('front.toDrawersBody')}</p>
      </ConfirmDialog>
    </fieldset>
  );
}
