import {
  LIMITS,
  updateHardwareProfile,
  type DesignDocument,
  type HardwareProfiles,
  type OpResult,
  type ScrewSpec,
} from '@/domain';
import type { UiKey } from '@/i18n';
import { useT } from '@/i18n/useT';
import { useApp } from '../../context';
import { ListField } from '../ListField';
import { NumberField } from '../NumberField';
import { TextField } from '../TextField';

type FieldKey = Extract<UiKey, `field.${string}`>;

interface NumberSpec<P> {
  kind: 'number';
  label: FieldKey;
  get: (p: P) => number;
  set: (p: P, v: number) => P;
  min: number;
  max: number;
  integer?: boolean;
}

interface ListSpec<P> {
  kind: 'list';
  label: FieldKey;
  get: (p: P) => readonly number[];
  set: (p: P, v: number[]) => P;
  signed?: boolean;
}

type FieldSpec<P> = NumberSpec<P> | ListSpec<P>;

const LEN = LIMITS.length;
const DIA = LIMITS.diameter;
const DEPTH = LIMITS.depth;
const POS = { min: 1, max: LIMITS.length.max };

function num<P>(key: keyof P & string, label: FieldKey, range: { min: number; max: number }, integer = false): NumberSpec<P> {
  return {
    kind: 'number',
    label,
    get: (p) => p[key] as number,
    set: (p, v) => ({ ...p, [key]: v }),
    min: range.min,
    max: range.max,
    integer,
  };
}

function list<P>(key: keyof P & string, label: FieldKey): ListSpec<P> {
  return { kind: 'list', label, get: (p) => p[key] as readonly number[], set: (p, v) => ({ ...p, [key]: v }) };
}

type Hinge = HardwareProfiles['hinge'];
const HINGE_FIELDS: FieldSpec<Hinge>[] = [
  num('cupDiameterMm', 'field.cupDiameterMm', DIA),
  num('cupDepthMm', 'field.cupDepthMm', DEPTH),
  num('cupEdgeDistanceMm', 'field.cupEdgeDistanceMm', LEN),
  num('edgeOffsetMm', 'field.edgeOffsetMm', LEN),
  num('maxDoorWidthMm', 'field.maxDoorWidthMm', LEN),
  num('cupScrewsPerHinge', 'field.cupScrewsPerHinge', LIMITS.cupScrewsPerHinge, true),
  { kind: 'number', label: 'field.plateSetbackMm', get: (h) => h.plate.setbackFromFrontMm, set: (h, v) => ({ ...h, plate: { ...h.plate, setbackFromFrontMm: v } }), ...LEN },
  { kind: 'number', label: 'field.plateHoleDiameterMm', get: (h) => h.plate.holeDiameterMm, set: (h, v) => ({ ...h, plate: { ...h.plate, holeDiameterMm: v } }), ...DIA },
  { kind: 'number', label: 'field.plateHoleDepthMm', get: (h) => h.plate.holeDepthMm, set: (h, v) => ({ ...h, plate: { ...h.plate, holeDepthMm: v } }), ...DEPTH },
  { kind: 'list', label: 'field.plateOffsetsMm', signed: true, get: (h) => h.plate.holeOffsetsAlongMm, set: (h, v) => ({ ...h, plate: { ...h.plate, holeOffsetsAlongMm: v } }) },
  { kind: 'number', label: 'field.overlayFullMinMm', get: (h) => h.overlayRangesMm.full[0], set: (h, v) => ({ ...h, overlayRangesMm: { ...h.overlayRangesMm, full: [v, h.overlayRangesMm.full[1]] } }), ...LEN },
  { kind: 'number', label: 'field.overlayFullMaxMm', get: (h) => h.overlayRangesMm.full[1], set: (h, v) => ({ ...h, overlayRangesMm: { ...h.overlayRangesMm, full: [h.overlayRangesMm.full[0], v] } }), ...LEN },
  { kind: 'number', label: 'field.overlayHalfMinMm', get: (h) => h.overlayRangesMm.half[0], set: (h, v) => ({ ...h, overlayRangesMm: { ...h.overlayRangesMm, half: [v, h.overlayRangesMm.half[1]] } }), ...LEN },
  { kind: 'number', label: 'field.overlayHalfMaxMm', get: (h) => h.overlayRangesMm.half[1], set: (h, v) => ({ ...h, overlayRangesMm: { ...h.overlayRangesMm, half: [h.overlayRangesMm.half[0], v] } }), ...LEN },
];

type Slide = HardwareProfiles['slide'];
const SLIDE_FIELDS: FieldSpec<Slide>[] = [
  num('sideClearanceMm', 'field.sideClearanceMm', LEN),
  num('rearClearanceMm', 'field.rearClearanceMm', LEN),
  num('frontSetbackMm', 'field.frontSetbackMm', LEN),
  num('heightMm', 'field.heightMm', LEN),
  num('holeDiameterMm', 'field.holeDiameterMm', DIA),
  num('holeDepthMm', 'field.holeDepthMm', DEPTH),
  list('lengthsMm', 'field.lengthsMm'),
  list('cabinetHoleOffsetsMm', 'field.cabinetHoleOffsetsMm'),
  list('drawerHoleOffsetsMm', 'field.drawerHoleOffsetsMm'),
];

type ShelfPin = HardwareProfiles['shelfPin'];
const SHELF_PIN_FIELDS: FieldSpec<ShelfPin>[] = [
  num('holeDiameterMm', 'field.holeDiameterMm', DIA),
  num('holeDepthMm', 'field.holeDepthMm', DEPTH),
  num('rowSetbackMm', 'field.rowSetbackMm', LEN),
  num('pitchMm', 'field.pitchMm', POS),
  num('marginMm', 'field.marginMm', LEN),
  num('pinsPerShelf', 'field.pinsPerShelf', LIMITS.pinsPerShelf, true),
  num('shelfSideClearanceMm', 'field.shelfSideClearanceMm', LEN),
  num('shelfRearClearanceMm', 'field.shelfRearClearanceMm', LEN),
  num('shelfFrontSetbackOpenMm', 'field.shelfFrontSetbackOpenMm', LEN),
  num('shelfFrontSetbackDoorMm', 'field.shelfFrontSetbackDoorMm', LEN),
];

type Handle = HardwareProfiles['handles'][number];
const handleFields = (handle: Handle): FieldSpec<Handle>[] => [
  ...(handle.kind === 'bar'
    ? [{ kind: 'number', label: 'field.centerDistanceMm', get: (h: Handle) => h.centerDistanceMm ?? 0, set: (h: Handle, v: number) => ({ ...h, centerDistanceMm: v }), ...POS } as NumberSpec<Handle>]
    : []),
  num('holeDiameterMm', 'field.holeDiameterMm', DIA),
  list('screwLengthsMm', 'field.screwLengthsMm'),
  num('screwEngagementMm', 'field.screwEngagementMm', LEN),
];

type Rail = HardwareProfiles['clothesRail'];
const RAIL_FIELDS: FieldSpec<Rail>[] = [
  num('tubeDiameterMm', 'field.tubeDiameterMm', DIA),
  num('centerBelowTopMm', 'field.centerBelowTopMm', LEN),
  num('endAllowanceMm', 'field.endAllowanceMm', LEN),
  num('screwsPerSupport', 'field.screwsPerSupport', LIMITS.screwsPerSupport, true),
];

const SCREW_FIELDS: FieldSpec<ScrewSpec>[] = [
  num('diameterMm', 'field.diameterMm', DIA),
  num('lengthMm', 'field.lengthMm', LEN),
  num('clearanceHoleMm', 'field.clearanceHoleMm', DIA),
  num('countersinkDiameterMm', 'field.countersinkDiameterMm', DIA),
  num('pilotHoleMm', 'field.pilotHoleMm', DIA),
];

type Bracket = HardwareProfiles['plinthBracket'];
const BRACKET_FIELDS: FieldSpec<Bracket>[] = [
  num('screwLengthMm', 'field.screwLengthMm', LEN),
  num('screwsPerBracket', 'field.screwsPerBracket', LIMITS.screwsPerBracket, true),
  num('maxSpacingMm', 'field.maxSpacingMm', POS),
];

const SCREW_KEYS = ['carcassScrew', 'plinthScrew', 'drawerBoxScrew', 'drawerBottomScrew', 'frontScrew', 'backScrew'] as const;

function Fields<P>({ prefix, profile, fields, onCommit }: { prefix: string; profile: P; fields: FieldSpec<P>[]; onCommit: (p: P) => OpResult }) {
  const { t } = useT();
  return (
    <>
      {fields.map((f) =>
        f.kind === 'number' ? (
          <NumberField
            key={f.label}
            fieldId={`${prefix}-${f.label}`}
            label={t(f.label)}
            valueMm={f.get(profile)}
            min={f.min}
            max={f.max}
            integer={f.integer}
            onCommit={(v) => onCommit(f.set(profile, v))}
          />
        ) : (
          <ListField
            key={f.label}
            id={`${prefix}-${f.label}`}
            label={t(f.label)}
            values={f.get(profile)}
            signed={f.signed}
            onCommit={(v) => onCommit(f.set(profile, v))}
          />
        ),
      )}
    </>
  );
}

interface Verifiable {
  id: string;
  verifiedByUser: boolean;
  sourceNote: string;
}

function VerificationFields<P extends Verifiable>({ profile, onCommit }: { profile: P; onCommit: (p: P) => OpResult }) {
  const { t } = useT();
  return (
    <>
      <label className="checkbox">
        <input
          id={`field-profile-${profile.id}-verified`}
          type="checkbox"
          checked={profile.verifiedByUser}
          onChange={(e) => onCommit({ ...profile, verifiedByUser: e.target.checked })}
        />
        {t('profile.verified')}
      </label>
      <TextField
        id={`field-profile-${profile.id}-source`}
        label={t('profile.sourceNote')}
        value={profile.sourceNote}
        maxLength={LIMITS.sourceNote.max}
        onCommit={(sourceNote) => onCommit({ ...profile, sourceNote })}
      />
    </>
  );
}

function Card({ id, title, unverified, children }: { id: string; title: string; unverified?: boolean; children: React.ReactNode }) {
  const { t } = useT();
  return (
    <details className="editor-card" id={id}>
      <summary>
        {title}
        {unverified && <span className="tag tag-warning">{t('profile.unverified')}</span>}
      </summary>
      {children}
    </details>
  );
}

/** Hardware profiles of this design (plan F-007); marking a profile as verified removes its warning (AC-023). */
export function HardwareInspector({ doc }: { doc: DesignDocument }) {
  const { t } = useT();
  const { editor } = useApp();
  const hw = doc.hardware;
  const update = <K extends keyof HardwareProfiles>(key: K, value: HardwareProfiles[K]): OpResult =>
    editor.getState().commit((d: DesignDocument, a: { value: HardwareProfiles[K] }) => updateHardwareProfile(d, { key, value: a.value }), { value });

  return (
    <div className="inspector-form">
      <h3>{t('hardwareProfiles.heading')}</h3>
      <p className="hint">{t('hardwareProfiles.hint')}</p>

      <Card id={`field-profile-${hw.hinge.id}`} title={t('profile.hinge')} unverified={!hw.hinge.verifiedByUser}>
        <VerificationFields profile={hw.hinge} onCommit={(p) => update('hinge', p)} />
        <Fields prefix="field-hinge" profile={hw.hinge} fields={HINGE_FIELDS} onCommit={(p) => update('hinge', p)} />
      </Card>
      <Card id={`field-profile-${hw.slide.id}`} title={t('profile.slide')} unverified={!hw.slide.verifiedByUser}>
        <VerificationFields profile={hw.slide} onCommit={(p) => update('slide', p)} />
        <Fields prefix="field-slide" profile={hw.slide} fields={SLIDE_FIELDS} onCommit={(p) => update('slide', p)} />
      </Card>
      {hw.handles.map((handle, i) => {
        const commitHandle = (p: Handle) => update('handles', hw.handles.map((h, j) => (j === i ? p : h)));
        return (
          <Card key={handle.id} id={`field-profile-${handle.id}`} title={t('profile.handle', { name: handle.name })} unverified={!handle.verifiedByUser}>
            <VerificationFields profile={handle} onCommit={commitHandle} />
            <Fields prefix={`field-handle-${handle.id}`} profile={handle} fields={handleFields(handle)} onCommit={commitHandle} />
          </Card>
        );
      })}
      <Card id={`field-profile-${hw.clothesRail.id}`} title={t('profile.clothesRail')} unverified={!hw.clothesRail.verifiedByUser}>
        <VerificationFields profile={hw.clothesRail} onCommit={(p) => update('clothesRail', p)} />
        <Fields prefix="field-rail" profile={hw.clothesRail} fields={RAIL_FIELDS} onCommit={(p) => update('clothesRail', p)} />
      </Card>
      <Card id={`field-profile-${hw.shelfPin.id}`} title={t('profile.shelfPin')}>
        <Fields prefix="field-pin" profile={hw.shelfPin} fields={SHELF_PIN_FIELDS} onCommit={(p) => update('shelfPin', p)} />
      </Card>
      {SCREW_KEYS.map((key) => (
        <Card key={key} id={`field-profile-${key}`} title={`${t('profile.screws')}: ${t(`screw.${key}`)}`}>
          <TextField
            id={`field-screw-${key}-label`}
            label={t('field.label')}
            value={hw[key].label}
            maxLength={LIMITS.name.max}
            onCommit={(label) => update(key, { ...hw[key], label })}
          />
          <Fields prefix={`field-screw-${key}`} profile={hw[key]} fields={SCREW_FIELDS} onCommit={(p) => update(key, p)} />
        </Card>
      ))}
      <Card id="field-profile-back" title={t('profile.back')}>
        <TextField
          id="field-back-nail-label"
          label={t('field.label')}
          value={hw.backNailLabel}
          maxLength={LIMITS.name.max}
          onCommit={(label) => update('backNailLabel', label)}
        />
        <NumberField
          fieldId="field-back-spacing"
          label={t('field.backFastenerSpacingMm')}
          valueMm={hw.backFastenerSpacingMm}
          {...POS}
          onCommit={(v) => update('backFastenerSpacingMm', v)}
        />
        <NumberField
          fieldId="field-back-end-offset"
          label={t('field.backFastenerEndOffsetMm')}
          valueMm={hw.backFastenerEndOffsetMm}
          {...LEN}
          onCommit={(v) => update('backFastenerEndOffsetMm', v)}
        />
      </Card>
      <Card id="field-profile-plinthBracket" title={t('profile.plinthBracket')}>
        <Fields prefix="field-bracket" profile={hw.plinthBracket} fields={BRACKET_FIELDS} onCommit={(p) => update('plinthBracket', p)} />
      </Card>
    </div>
  );
}
