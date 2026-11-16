import type { DesignDocument } from '@/domain';

export const MAX_HISTORY = 100;

export interface History {
  past: DesignDocument[];
  future: DesignDocument[];
}

export const EMPTY_HISTORY: History = { past: [], future: [] };

/** Records the document before a committed edit; a new edit discards the redo branch. */
export function record(history: History, previous: DesignDocument): History {
  const past = [...history.past, previous];
  return { past: past.length > MAX_HISTORY ? past.slice(past.length - MAX_HISTORY) : past, future: [] };
}

export function undo(history: History, current: DesignDocument): { history: History; doc: DesignDocument } | null {
  const doc = history.past.at(-1);
  if (!doc) return null;
  return { doc, history: { past: history.past.slice(0, -1), future: [current, ...history.future] } };
}

export function redo(history: History, current: DesignDocument): { history: History; doc: DesignDocument } | null {
  const [doc, ...future] = history.future;
  if (!doc) return null;
  return { doc, history: { past: [...history.past, current], future } };
}
