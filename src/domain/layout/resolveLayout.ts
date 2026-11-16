import type { DesignDocument, Material } from '../document/types';
import { issue, type ValidationIssue } from '../validate/catalogue';
import type { Dimensions, ResolvedColumn, ResolvedLayout } from '../derive/model';
import { distribute } from './distribute';

export const CARCASS_TARGET_ID = 'carcass';

export function materialById(doc: DesignDocument, id: string): Material | undefined {
  return doc.materials.find((m) => m.id === id);
}

/** Requires resolved material references (checked by `checkReferences` first). */
export function resolveDimensions(doc: DesignDocument): Dimensions {
  const thickness = (group: keyof DesignDocument['carcass']['materialIds']) =>
    materialById(doc, doc.carcass.materialIds[group])?.thicknessMm ?? 0;
  const { widthMm: W, heightMm: H, depthMm: D, base } = doc.carcass;
  const hP = base.kind === 'plinth' ? base.heightMm : 0;
  const t = thickness('carcass');
  const tB = thickness('back');
  return {
    W,
    H,
    D,
    hP,
    t,
    tF: thickness('shelves'),
    tB,
    tFr: thickness('fronts'),
    tb: thickness('drawerBox'),
    tbt: thickness('drawerBottom'),
    tP: thickness('plinth'),
    Hc: H - hP,
    Dc: D - tB,
    Wi: W - 2 * t,
    Hi: H - hP - 2 * t,
  };
}

export type LayoutResult = { ok: true; layout: ResolvedLayout } | { ok: false; issues: ValidationIssue[] };

/** Plan §4.4: column x-ranges and section y-ranges; distribution failures are layout errors. */
export function resolveLayout(doc: DesignDocument, dims: Dimensions): LayoutResult {
  const c = doc.construction;
  const cols = doc.layout.columns;
  const issues: ValidationIssue[] = [];

  const available = dims.Wi - (cols.length - 1) * dims.t;
  const widths = distribute(available, cols.map((col) => col.width), c.minColumnClearWidthMm);
  if (!widths.ok) {
    if (widths.reason === 'DONT_FIT') {
      issues.push(
        issue('LAYOUT_COLUMNS_DONT_FIT', { kind: 'carcass', id: CARCASS_TARGET_ID, field: 'widthMm' }, { availableMm: available }),
      );
    } else {
      for (const i of widths.tooSmall) {
        const col = cols[i];
        if (!col) continue;
        issues.push(
          issue('COLUMN_TOO_NARROW', { kind: 'column', id: col.id, field: 'width' }, {
            widthMm: widths.sizes[i] ?? 0,
            minMm: c.minColumnClearWidthMm,
          }),
        );
      }
    }
    return { ok: false, issues };
  }

  const columns: ResolvedColumn[] = [];
  let x0 = dims.t;
  cols.forEach((col, ci) => {
    const widthMm = widths.sizes[ci] ?? 0;
    const availableH = dims.Hi - (col.sections.length - 1) * dims.tF;
    const heights = distribute(availableH, col.sections.map((s) => s.height), c.minSectionClearHeightMm);
    const resolved: ResolvedColumn = { id: col.id, index: ci, x0, x1: x0 + widthMm, widthMm, sections: [] };
    if (!heights.ok) {
      if (heights.reason === 'DONT_FIT') {
        issues.push(issue('LAYOUT_SECTIONS_DONT_FIT', { kind: 'column', id: col.id }, { availableMm: availableH }));
      } else {
        for (const i of heights.tooSmall) {
          const section = col.sections[i];
          if (!section) continue;
          issues.push(
            issue('SECTION_TOO_LOW', { kind: 'section', id: section.id, field: 'height' }, {
              heightMm: heights.sizes[i] ?? 0,
              minMm: c.minSectionClearHeightMm,
            }),
          );
        }
      }
    } else {
      let y0 = dims.hP + dims.t;
      col.sections.forEach((section, si) => {
        const heightMm = heights.sizes[si] ?? 0;
        resolved.sections.push({ id: section.id, columnId: col.id, index: si, y0, y1: y0 + heightMm, heightMm });
        y0 += heightMm + dims.tF;
      });
    }
    columns.push(resolved);
    x0 += widthMm + dims.t;
  });

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, layout: { dims, columns } };
}
