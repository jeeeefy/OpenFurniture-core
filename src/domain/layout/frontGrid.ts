import type { DesignDocument, Section } from '../document/types';
import type { Dimensions, ResolvedLayout, ResolvedSection } from '../derive/model';

export type EdgeType = 'outer' | 'full' | 'half';

export interface FrontZone {
  xL: number;
  xR: number;
  yB: number;
  yT: number;
  edges: { left: EdgeType; right: EdgeType; bottom: EdgeType; top: EdgeType };
}

const overlaps = (a0: number, a1: number, b: ResolvedSection) => a0 < b.y1 && a1 > b.y0;

/** Number of sections a front covers, counted upwards from its own section. */
export function frontSpan(section: Section | undefined): number {
  const front = section?.front;
  return front && (front.kind === 'door' || front.kind === 'doubleDoor') ? (front.spanSections ?? 1) : 1;
}

/** Index of the section whose front covers section `si` (its own or a door spanning up from below), or null. */
export function coveringSection(sections: readonly Section[], si: number): number | null {
  for (let j = si; j >= 0; j -= 1) {
    const section = sections[j];
    if (section && section.front.kind !== 'none') return j + frontSpan(section) - 1 >= si ? j : null;
  }
  return null;
}

/** True if a door (own or spanning) closes the section, so shelves and inner drawers sit behind it. */
export function behindDoor(sections: readonly Section[], si: number): boolean {
  const owner = coveringSection(sections, si);
  const kind = owner === null ? null : sections[owner]?.front.kind;
  return kind === 'door' || kind === 'doubleDoor';
}

const covered = (sections: readonly Section[], si: number) => coveringSection(sections, si) !== null;

/** Plan §4.4 front grid: the zone of one section in the plane z = D, with the type of each edge. */
export function frontZone(
  doc: DesignDocument,
  layout: ResolvedLayout,
  dims: Dimensions,
  columnIndex: number,
  sectionIndex: number,
): FrontZone | null {
  const { W, H, hP, t, tF } = dims;
  const reveal = doc.construction.frontRevealMm;
  const gap = doc.construction.frontGapMm;
  const columns = layout.columns;
  const rc = columns[columnIndex];
  const rs = rc?.sections[sectionIndex];
  const column = doc.layout.columns[columnIndex];
  if (!rc || !rs || !column) return null;
  const topIndex = Math.min(sectionIndex + frontSpan(column.sections[sectionIndex]) - 1, column.sections.length - 1);
  const rsTop = rc.sections[topIndex] ?? rs;

  const neighbourHasFront = (ci: number) => {
    const neighbour = columns[ci];
    const sections = doc.layout.columns[ci]?.sections ?? [];
    return neighbour?.sections.some((s, si) => overlaps(rs.y0, rsTop.y1, s) && covered(sections, si)) ?? false;
  };

  let xL: number;
  let left: EdgeType;
  if (columnIndex === 0) {
    xL = reveal;
    left = 'outer';
  } else {
    const a = rc.x0 - t;
    [xL, left] = neighbourHasFront(columnIndex - 1) ? [a + t / 2 + gap / 2, 'half'] : [a + reveal, 'full'];
  }

  let xR: number;
  let right: EdgeType;
  if (columnIndex === columns.length - 1) {
    xR = W - reveal;
    right = 'outer';
  } else {
    const a = rc.x1;
    [xR, right] = neighbourHasFront(columnIndex + 1) ? [a + t / 2 - gap / 2, 'half'] : [a + t - reveal, 'full'];
  }

  let yB: number;
  let bottom: EdgeType;
  if (sectionIndex === 0) {
    yB = hP + reveal;
    bottom = 'outer';
  } else {
    const b = rs.y0 - tF;
    [yB, bottom] = covered(column.sections, sectionIndex - 1) ? [b + tF / 2 + gap / 2, 'half'] : [b + reveal, 'full'];
  }

  let yT: number;
  let top: EdgeType;
  if (topIndex === column.sections.length - 1) {
    yT = H - reveal;
    top = 'outer';
  } else {
    const b = rsTop.y1;
    [yT, top] = covered(column.sections, topIndex + 1) ? [b + tF / 2 - gap / 2, 'half'] : [b + tF - reveal, 'full'];
  }

  return { xL, xR, yB, yT, edges: { left, right, bottom, top } };
}
