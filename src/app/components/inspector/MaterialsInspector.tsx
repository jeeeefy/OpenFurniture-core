import {
  addMaterial,
  DEFAULT_SAW_KERF_MM,
  DEFAULT_SHEET_TRIM_MM,
  LIMITS,
  removeMaterial,
  updateConstruction,
  updateMaterial,
  type DesignDocument,
  type Material,
  type OpResult,
} from '@/domain';
import { useT } from '@/i18n/useT';
import { useApp } from '../../context';
import { NumberField } from '../NumberField';
import { TextField } from '../TextField';

const KINDS: Material['kind'][] = ['plywood', 'mdf', 'particleboard', 'melamine', 'hdf', 'other'];
const DEFAULT_EDGE_BAND = { thicknessMm: 0.5, deductFromCutSize: false };
const DEFAULT_MAX_SPAN_MM = 700;

/** Further board sizes; the cutting layout picks the mix with the least area to buy. */
function ExtraSheets({ material, update }: { material: Material; update: (patch: Partial<Material>) => OpResult }) {
  const { t } = useT();
  const extra = material.extraSheets ?? [];
  const id = (field: string) => `field-material-${material.id}-${field}`;
  const setAt = (i: number, size: { lengthMm: number; widthMm: number }) =>
    update({ extraSheets: extra.map((s, k) => (k === i ? size : s)) });
  return (
    <fieldset className="extra-sheets" id={id('extraSheets')}>
      <legend>{t('material.extraSheets')}</legend>
      {extra.map((size, i) => (
        <div key={i} className="extra-sheet" data-testid="extra-sheet">
          <NumberField
            fieldId={id(`extraSheet-${String(i)}-length`)}
            label={t('material.extraSheetLength', { n: i + 2 })}
            valueMm={size.lengthMm}
            {...LIMITS.sheetSize}
            onCommit={(lengthMm) => setAt(i, { ...size, lengthMm })}
          />
          <NumberField
            fieldId={id(`extraSheet-${String(i)}-width`)}
            label={t('material.extraSheetWidth', { n: i + 2 })}
            valueMm={size.widthMm}
            {...LIMITS.sheetSize}
            onCommit={(widthMm) => setAt(i, { ...size, widthMm })}
          />
          <button
            type="button"
            onClick={() => {
              const rest = extra.filter((_, k) => k !== i);
              update(rest.length > 0 ? { extraSheets: rest } : { extraSheets: undefined });
            }}
          >
            {t('material.removeSheet', { n: i + 2 })}
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={extra.length >= LIMITS.extraSheets.max}
        onClick={() =>
          update({
            extraSheets: [
              ...extra,
              { lengthMm: material.sheet.lengthMm, widthMm: Math.max(LIMITS.sheetSize.min, Math.round(material.sheet.widthMm / 2)) },
            ],
          })
        }
      >
        {t('material.addSheet')}
      </button>
      <p className="hint">{t('material.extraSheetsHint')}</p>
    </fieldset>
  );
}

function MaterialEditor({ doc, material }: { doc: DesignDocument; material: Material }) {
  const { t } = useT();
  const { editor } = useApp();
  const update = (patch: Partial<Material>) => editor.getState().commit(updateMaterial, { material: { ...material, ...patch } });
  const id = (field: string) => `field-material-${material.id}-${field}`;
  const inUse = Object.values(doc.carcass.materialIds).includes(material.id);

  return (
    <details className="editor-card" open={doc.materials.length <= 3}>
      <summary>{t('material.option', { name: material.name, thicknessMm: material.thicknessMm })}</summary>
      <TextField
        id={id('name')}
        label={t('material.name')}
        value={material.name}
        maxLength={LIMITS.name.max}
        onCommit={(name) => update({ name: name.trim() })}
      />
      <div className="field">
        <label htmlFor={id('kind')}>{t('material.kind')}</label>
        <select id={id('kind')} value={material.kind} onChange={(e) => update({ kind: e.target.value as Material['kind'] })}>
          {KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`material.kind.${kind}`)}
            </option>
          ))}
        </select>
      </div>
      <NumberField
        fieldId={id('thicknessMm')}
        label={t('material.thickness')}
        valueMm={material.thicknessMm}
        {...LIMITS.materialThickness}
        onCommit={(thicknessMm) => update({ thicknessMm })}
      />
      <NumberField
        fieldId={id('sheetLength')}
        label={t('material.sheetLength')}
        valueMm={material.sheet.lengthMm}
        {...LIMITS.sheetSize}
        onCommit={(lengthMm) => update({ sheet: { ...material.sheet, lengthMm } })}
      />
      <NumberField
        fieldId={id('sheetWidth')}
        label={t('material.sheetWidth')}
        valueMm={material.sheet.widthMm}
        {...LIMITS.sheetSize}
        onCommit={(widthMm) => update({ sheet: { ...material.sheet, widthMm } })}
      />
      <ExtraSheets material={material} update={update} />
      <label className="checkbox">
        <input type="checkbox" checked={material.hasGrain} onChange={(e) => update({ hasGrain: e.target.checked })} />
        {t('material.hasGrain')}
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={material.edgeBand !== null}
          onChange={(e) => update({ edgeBand: e.target.checked ? DEFAULT_EDGE_BAND : null })}
        />
        {t('material.edgeBand')}
      </label>
      {material.edgeBand && (
        <>
          <NumberField
            fieldId={id('edgeBand')}
            label={t('material.edgeBandThickness')}
            valueMm={material.edgeBand.thicknessMm}
            min={0.1}
            max={5}
            onCommit={(thicknessMm) => update({ edgeBand: { ...DEFAULT_EDGE_BAND, ...material.edgeBand, thicknessMm } })}
          />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={material.edgeBand.deductFromCutSize}
              onChange={(e) =>
                update({ edgeBand: { ...DEFAULT_EDGE_BAND, ...material.edgeBand, deductFromCutSize: e.target.checked } })
              }
            />
            {t('material.deduct')}
          </label>
        </>
      )}
      <label className="checkbox">
        <input
          type="checkbox"
          checked={material.maxShelfSpanMm !== null}
          onChange={(e) => update({ maxShelfSpanMm: e.target.checked ? DEFAULT_MAX_SPAN_MM : null })}
        />
        {t('material.maxSpanCheck')}
      </label>
      {material.maxShelfSpanMm !== null && (
        <NumberField
          fieldId={id('maxShelfSpanMm')}
          label={t('material.maxSpan')}
          valueMm={material.maxShelfSpanMm}
          min={1}
          max={LIMITS.length.max}
          onCommit={(maxShelfSpanMm) => update({ maxShelfSpanMm })}
        />
      )}
      <button
        type="button"
        className="danger"
        disabled={inUse}
        aria-describedby={inUse ? id('in-use') : undefined}
        onClick={() => editor.getState().commit(removeMaterial, { materialId: material.id })}
      >
        {t('materials.remove')}
      </button>
      {inUse && (
        <p className="hint" id={id('in-use')}>
          {t('materials.inUse')}
        </p>
      )}
    </details>
  );
}

/** Saw kerf and edge trim used by the cutting layout (board sizes are set per material above). */
function CuttingSettings({ doc }: { doc: DesignDocument }) {
  const { t } = useT();
  const { editor } = useApp();
  const c = doc.construction;
  return (
    <details className="editor-card" id="field-cutting">
      <summary>{t('cutting.settingsHeading')}</summary>
      <NumberField
        fieldId="field-cutting-kerf"
        label={t('cutting.kerf')}
        valueMm={c.sawKerfMm ?? DEFAULT_SAW_KERF_MM}
        {...LIMITS.sawKerf}
        onCommit={(sawKerfMm) => editor.getState().commit(updateConstruction, { patch: { sawKerfMm } })}
      />
      <NumberField
        fieldId="field-cutting-trim"
        label={t('cutting.trim')}
        valueMm={c.sheetTrimMm ?? DEFAULT_SHEET_TRIM_MM}
        {...LIMITS.sheetTrim}
        onCommit={(sheetTrimMm) => editor.getState().commit(updateConstruction, { patch: { sheetTrimMm } })}
      />
      <p className="hint">{t('cutting.settingsHint')}</p>
    </details>
  );
}

/** Materials of this design only; presets are never changed (AC-022). */
export function MaterialsInspector({ doc }: { doc: DesignDocument }) {
  const { t } = useT();
  const { editor, newId } = useApp();
  const add = () => {
    const template = doc.materials[0];
    if (!template) return;
    editor.getState().commit(addMaterial, { material: { ...structuredClone(template), id: newId(), name: t('materials.newName') } });
  };
  return (
    <div className="inspector-form">
      <h3>{t('materials.heading')}</h3>
      {doc.materials.map((material) => (
        <MaterialEditor key={material.id} doc={doc} material={material} />
      ))}
      <button type="button" disabled={doc.materials.length >= LIMITS.materials.max} onClick={add}>
        {t('materials.add')}
      </button>
      <CuttingSettings doc={doc} />
    </div>
  );
}
