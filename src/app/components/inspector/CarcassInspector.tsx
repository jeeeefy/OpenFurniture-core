import {
  DEFAULT_PLINTH,
  LIMITS,
  setBackFastener,
  setBase,
  setCarcassDimension,
  setMaterialAssignment,
  type DesignDocument,
  type MaterialGroup,
  type OpResult,
} from '@/domain';
import { useT } from '@/i18n/useT';
import { useApp } from '../../context';
import { selectDerived } from '../../store/selectors';
import { NumberField } from '../NumberField';

const GROUPS: MaterialGroup[] = ['carcass', 'shelves', 'back', 'fronts', 'drawerBox', 'drawerBottom', 'plinth'];
const PLINTH_HEIGHT = { min: 50, max: 200 };

type PlinthField = 'heightMm' | 'setbackFrontMm' | 'setbackBackMm' | 'setbackSidesMm';
const PLINTH_FIELDS: { field: PlinthField; label: 'carcass.plinthHeight' | 'carcass.setbackFront' | 'carcass.setbackBack' | 'carcass.setbackSides' }[] = [
  { field: 'heightMm', label: 'carcass.plinthHeight' },
  { field: 'setbackFrontMm', label: 'carcass.setbackFront' },
  { field: 'setbackBackMm', label: 'carcass.setbackBack' },
  { field: 'setbackSidesMm', label: 'carcass.setbackSides' },
];

export function CarcassInspector({ doc }: { doc: DesignDocument }) {
  const { t } = useT();
  const { editor } = useApp();
  const commit = editor.getState().commit;
  const { carcass } = doc;
  const base = carcass.base;
  const derived = selectDerived(doc);
  const envelope = derived.ok ? derived.model.envelope : derived.envelope;

  const setPlinthField = (field: PlinthField, value: number): OpResult => {
    if (base.kind !== 'plinth') return { ok: false, reason: 'not-found' };
    return commit(setBase, { base: { ...base, [field]: value } });
  };

  return (
    <div className="inspector-form">
      <h3>{t('carcass.heading')}</h3>
      <p className="hint">{t('carcass.envelopeHint')}</p>
      <NumberField
        fieldId="field-carcass-widthMm"
        label={t('carcass.width')}
        valueMm={carcass.widthMm}
        {...LIMITS.widthMm}
        onCommit={(value) => commit(setCarcassDimension, { field: 'widthMm', value })}
      />
      <NumberField
        fieldId="field-carcass-heightMm"
        label={t('carcass.height')}
        valueMm={carcass.heightMm}
        {...LIMITS.heightMm}
        onCommit={(value) => commit(setCarcassDimension, { field: 'heightMm', value })}
      />
      <NumberField
        fieldId="field-carcass-depthMm"
        label={t('carcass.depth')}
        valueMm={carcass.depthMm}
        {...LIMITS.depthMm}
        onCommit={(value) => commit(setCarcassDimension, { field: 'depthMm', value })}
      />
      {envelope.depthWithFrontsMm !== envelope.depthMm && (
        <p className="hint">{t('carcass.depthWithFronts', { depthMm: envelope.depthWithFrontsMm })}</p>
      )}

      <fieldset id="field-carcass-base">
        <legend>{t('carcass.base')}</legend>
        <label>
          <input
            type="radio"
            name="carcass-base"
            checked={base.kind === 'none'}
            onChange={() => commit(setBase, { base: { kind: 'none' } })}
          />
          {t('carcass.base.none')}
        </label>
        <label>
          <input
            type="radio"
            name="carcass-base"
            checked={base.kind === 'plinth'}
            onChange={() => commit(setBase, { base: DEFAULT_PLINTH })}
          />
          {t('carcass.base.plinth')}
        </label>
        {base.kind === 'plinth' &&
          PLINTH_FIELDS.map(({ field, label }) => (
            <NumberField
              key={field}
              fieldId={`field-carcass-base-${field}`}
              label={t(label)}
              valueMm={base[field]}
              min={field === 'heightMm' ? PLINTH_HEIGHT.min : LIMITS.length.min}
              max={field === 'heightMm' ? PLINTH_HEIGHT.max : LIMITS.length.max}
              onCommit={(value) => setPlinthField(field, value)}
            />
          ))}
      </fieldset>

      <fieldset id="field-carcass-back">
        <legend>{t('carcass.backFastener')}</legend>
        {(['nail', 'screw'] as const).map((fastener) => (
          <label key={fastener}>
            <input
              type="radio"
              name="carcass-back-fastener"
              checked={carcass.back.fastener === fastener}
              onChange={() => commit(setBackFastener, { fastener })}
            />
            {t(`carcass.fastener.${fastener}`)}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>{t('carcass.materials')}</legend>
        {GROUPS.map((group) => (
          <div className="field" key={group}>
            <label htmlFor={`field-carcass-material-${group}`}>{t(`materialGroup.${group}`)}</label>
            <select
              id={`field-carcass-material-${group}`}
              value={carcass.materialIds[group]}
              onChange={(e) => commit(setMaterialAssignment, { group, materialId: e.target.value })}
            >
              {doc.materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {t('material.option', { name: m.name, thicknessMm: m.thicknessMm })}
                </option>
              ))}
            </select>
          </div>
        ))}
      </fieldset>
    </div>
  );
}
