import { useState } from 'react';
import {
  behindDoor,
  INNER_DRAWER_DOOR_SETBACK_MM,
  LIMITS,
  mergeSectionWithAbove,
  roundTo01,
  setInterior,
  setSectionHeight,
  splitSection,
  type DesignDocument,
  type Interior,
  type Section,
} from '@/domain';
import { useT } from '@/i18n/useT';
import { useApp } from '../../context';
import { selectDerived } from '../../store/selectors';
import { ConfirmDialog } from '../ConfirmDialog';
import { NumberField } from '../NumberField';
import { SizeSpecField } from '../SizeSpecField';
import { FrontEditor } from './FrontEditor';

const INTERIORS: Interior['kind'][] = ['empty', 'adjustableShelves', 'clothesRail', 'innerDrawers'];
const SHELF_COUNTS = Array.from(
  { length: LIMITS.adjustableShelves.max - LIMITS.adjustableShelves.min + 1 },
  (_, i) => LIMITS.adjustableShelves.min + i,
);
const INNER_DRAWER_COUNTS = Array.from(
  { length: LIMITS.innerDrawers.max - LIMITS.innerDrawers.min + 1 },
  (_, i) => LIMITS.innerDrawers.min + i,
);
const DEFAULT_INNER_DRAWERS = 2;

const isEmptySection = (s: Section) => s.interior.kind === 'empty' && s.front.kind === 'none';

function interiorOf(kind: Interior['kind'], current: Interior): Interior {
  if (kind === 'adjustableShelves') return { kind, count: current.kind === 'adjustableShelves' ? current.count : 1 };
  if (kind === 'innerDrawers') return { kind, count: current.kind === 'innerDrawers' ? current.count : DEFAULT_INNER_DRAWERS };
  return { kind };
}

export function SectionInspector({ doc, sectionId }: { doc: DesignDocument; sectionId: string }) {
  const { t } = useT();
  const { editor, newId } = useApp();
  const [confirmMerge, setConfirmMerge] = useState(false);
  const columnIndex = doc.layout.columns.findIndex((c) => c.sections.some((s) => s.id === sectionId));
  const column = doc.layout.columns[columnIndex];
  const sectionIndex = column?.sections.findIndex((s) => s.id === sectionId) ?? -1;
  const section = column?.sections[sectionIndex];
  if (!column || !section) return null;
  const above = column.sections[sectionIndex + 1];
  const derived = selectDerived(doc);
  const resolvedSection = derived.ok ? derived.model.layout.columns[columnIndex]?.sections[sectionIndex] ?? null : null;
  const resolved = resolvedSection?.heightMm ?? null;
  const shelfInterior = section.interior.kind === 'adjustableShelves' ? section.interior : null;
  const shelfThickness = doc.materials.find((m) => m.id === doc.carcass.materialIds.shelves)?.thicknessMm ?? 18;
  const shelfPositions = (() => {
    if (!shelfInterior) return [];
    const count = shelfInterior.count;
    const parts =
      derived.ok && resolvedSection
        ? derived.model.parts
            .filter((p) => p.role === 'adjustable-shelf' && p.ownerId === sectionId)
            .sort((a, b) => a.box.min[1] - b.box.min[1])
        : [];
    if (parts.length === count && resolvedSection) return parts.map((p) => roundTo01(p.box.min[1] - resolvedSection.y0));
    const stored = shelfInterior.positionsMm;
    if (stored && stored.length === count) return [...stored];
    return Array.from({ length: count }, (_, i) => (resolved !== null ? roundTo01(((i + 1) * resolved) / (count + 1)) : 0));
  })();
  const { commit } = editor.getState();
  const hasDrawers = section.front.kind === 'drawers';
  const commitInterior = (interior: Interior) => commit(setInterior, { sectionId, interior });

  const merge = () => {
    setConfirmMerge(false);
    commit(mergeSectionWithAbove, { sectionId });
  };

  return (
    <div className="inspector-form">
      <h3>{t('section.heading', { column: columnIndex + 1, section: sectionIndex + 1 })}</h3>
      <SizeSpecField
        fieldId="field-section-height"
        legend={t('section.heightMode')}
        label={t('section.height')}
        spec={section.height}
        resolvedMm={resolved}
        min={doc.construction.minSectionClearHeightMm}
        max={LIMITS.heightMm.max}
        onCommit={(height) => commit(setSectionHeight, { sectionId, height })}
      />

      <fieldset id="field-section-interior" disabled={hasDrawers}>
        <legend>{t('section.interior')}</legend>
        {hasDrawers && <p className="hint">{t('section.drawersHint')}</p>}
        {INTERIORS.map((kind) => (
          <label key={kind}>
            <input
              type="radio"
              name="section-interior"
              checked={section.interior.kind === kind}
              onChange={() => commitInterior(interiorOf(kind, section.interior))}
            />
            {t(`section.interior.${kind}`)}
          </label>
        ))}
        {shelfInterior && (
          <>
            <div className="field">
              <label htmlFor="field-section-shelf-count">{t('section.shelfCount')}</label>
              <select
                id="field-section-shelf-count"
                value={shelfInterior.count}
                onChange={(e) => commitInterior({ kind: 'adjustableShelves', count: Number(e.target.value) })}
              >
                {SHELF_COUNTS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            {shelfPositions.map((position, i) => (
              <NumberField
                key={`${String(i)}-${String(shelfInterior.count)}`}
                fieldId={`field-section-shelf-position-${String(i + 1)}`}
                label={t('section.shelfPosition', { n: i + 1 })}
                valueMm={position}
                min={0}
                max={resolved !== null ? Math.max(0, roundTo01(resolved - shelfThickness)) : LIMITS.heightMm.max}
                onCommit={(valueMm) => {
                  const positions = [...shelfPositions];
                  positions[i] = valueMm;
                  return commitInterior({ kind: 'adjustableShelves', count: shelfInterior.count, positionsMm: positions });
                }}
              />
            ))}
            <p className="hint">{t('section.shelfPositionsHint', { pitchMm: doc.hardware.shelfPin.pitchMm })}</p>
            {shelfInterior.positionsMm !== undefined && (
              <button
                type="button"
                onClick={() => commitInterior({ kind: 'adjustableShelves', count: shelfInterior.count })}
              >
                {t('section.shelfEven')}
              </button>
            )}
          </>
        )}
        {section.interior.kind === 'innerDrawers' && (
          <div className="field">
            <label htmlFor="field-section-inner-drawer-count">{t('section.innerDrawerCount')}</label>
            <select
              id="field-section-inner-drawer-count"
              value={section.interior.count}
              onChange={(e) => commitInterior({ kind: 'innerDrawers', count: Number(e.target.value) })}
            >
              {INNER_DRAWER_COUNTS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <p className="hint">
              {section.front.kind === 'door' || section.front.kind === 'doubleDoor' || behindDoor(column.sections, sectionIndex)
                ? t('section.innerDrawersBehindDoor', { setbackMm: INNER_DRAWER_DOOR_SETBACK_MM })
                : t('section.innerDrawersOpen')}
            </p>
          </div>
        )}
      </fieldset>

      <FrontEditor doc={doc} section={section} />

      <div className="button-stack">
        <button
          type="button"
          disabled={column.sections.length >= LIMITS.sectionsPerColumn.max}
          onClick={() => commit(splitSection, { sectionId, newSectionId: newId() })}
        >
          {t('section.split')}
        </button>
        <button
          type="button"
          disabled={!above}
          onClick={() => (above && !isEmptySection(above) ? setConfirmMerge(true) : merge())}
        >
          {t('section.merge')}
        </button>
      </div>
      <ConfirmDialog
        open={confirmMerge}
        title={t('section.mergeTitle')}
        confirmLabel={t('section.merge')}
        onCancel={() => setConfirmMerge(false)}
        onConfirm={merge}
      >
        <p>{t('section.mergeBody')}</p>
      </ConfirmDialog>
    </div>
  );
}
