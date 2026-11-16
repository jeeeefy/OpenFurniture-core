import {
  createDesign,
  deriveModel,
  type DesignDocument,
  type FurnitureModel,
  type Part,
  type Section,
  type SizeSpec,
  type TemplateId,
} from '@/domain';
import { counterIds, NOW } from '../helpers';

export function template(id: TemplateId): DesignDocument {
  return createDesign(id, counterIds(), NOW, id);
}

/** Blank carcass with the given envelope, carcass/back materials and no plinth. */
export function carcassDesign(
  W: number,
  H: number,
  D: number,
  opts: { carcass?: string; back?: string } = {},
): DesignDocument {
  const doc = template('blank');
  doc.carcass.widthMm = W;
  doc.carcass.heightMm = H;
  doc.carcass.depthMm = D;
  doc.carcass.materialIds.carcass = opts.carcass ?? 'mat-ply-18';
  doc.carcass.materialIds.back = opts.back ?? 'mat-hdf-3';
  return doc;
}

let sectionCounter = 0;

export function section(height: SizeSpec = { mode: 'auto' }, extra: Partial<Section> = {}): Section {
  sectionCounter += 1;
  return {
    id: `sec-${sectionCounter}`,
    height,
    interior: { kind: 'empty' },
    front: { kind: 'none' },
    ...extra,
  };
}

export function setColumns(doc: DesignDocument, columns: Section[][], widths?: SizeSpec[]): void {
  doc.layout.columns = columns.map((sections, i) => ({
    id: `col-${i + 1}`,
    width: widths?.[i] ?? { mode: 'auto' },
    sections,
  }));
}

/** Equal to the `cabinet` template of plan §4.9 (template itself follows in T-020). */
export function cabinetDesign(): DesignDocument {
  const doc = carcassDesign(800, 900, 450);
  doc.carcass.base = { kind: 'plinth', heightMm: 100, setbackFrontMm: 50, setbackBackMm: 0, setbackSidesMm: 0 };
  setColumns(doc, [
    [
      section(
        { mode: 'auto' },
        { interior: { kind: 'adjustableShelves', count: 2 }, front: { kind: 'doubleDoor', handleId: 'h-bar-128' } },
      ),
    ],
  ]);
  return doc;
}

const drawerFront = (ids: string[]) => ({
  kind: 'drawers' as const,
  handleId: 'h-bar-128',
  drawers: ids.map((id) => ({ id, frontHeight: { mode: 'auto' as const } })),
});

/** Equal to the `sideboard` template of plan §4.9. */
export function sideboardDesign(): DesignDocument {
  const doc = carcassDesign(1600, 800, 450);
  doc.carcass.base = { kind: 'plinth', heightMm: 100, setbackFrontMm: 50, setbackBackMm: 0, setbackSidesMm: 0 };
  setColumns(doc, [
    [section({ mode: 'auto' }, { interior: { kind: 'adjustableShelves', count: 1 }, front: { kind: 'door', hinge: 'left', handleId: 'h-bar-128' } })],
    [section({ mode: 'auto' }, { front: drawerFront(['sb-d1', 'sb-d2', 'sb-d3']) })],
    [section({ mode: 'auto' }, { interior: { kind: 'adjustableShelves', count: 1 }, front: { kind: 'door', hinge: 'right', handleId: 'h-bar-128' } })],
  ]);
  return doc;
}

/** Equal to the `chest` template of plan §4.9. */
export function chestDesign(): DesignDocument {
  const doc = carcassDesign(800, 1000, 450);
  doc.carcass.base = { kind: 'plinth', heightMm: 100, setbackFrontMm: 50, setbackBackMm: 0, setbackSidesMm: 0 };
  setColumns(doc, [[section({ mode: 'auto' }, { front: drawerFront(['ch-d1', 'ch-d2', 'ch-d3', 'ch-d4']) })]]);
  return doc;
}

export function drawerSection(ids: string[], extra: Partial<Section> = {}): Section {
  return section({ mode: 'auto' }, { front: drawerFront(ids), ...extra });
}

export function model(doc: DesignDocument): FurnitureModel {
  const result = deriveModel(doc);
  if (!result.ok) throw new Error(`Derivation failed: ${result.issues.map((i) => i.code).join(', ')}`);
  return result.model;
}

export function part(m: FurnitureModel, id: string): Part {
  const found = m.parts.find((p) => p.id === id);
  if (!found) throw new Error(`Part ${id} not found`);
  return found;
}

export const size = (p: Part) => [p.lengthMm, p.widthMm, p.thicknessMm];

export const codes = (m: { issues: { code: string }[] }) => m.issues.map((i) => i.code);
