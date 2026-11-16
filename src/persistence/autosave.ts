import type { DesignDocument } from '@/domain';
import { ConflictError, ReadOnlyError, RetryableError, type DesignRepository } from './types';

export type AutosaveEvent =
  | { status: 'saving' }
  | { status: 'saved'; revision: number; doc: DesignDocument }
  | { status: 'error'; error: unknown; quota: boolean }
  | { status: 'conflict'; error: ConflictError }
  | { status: 'offline' }
  | { status: 'readOnly'; error: ReadOnlyError };

export interface AutosaveSnapshot {
  doc: DesignDocument | null;
  baseRevision: number;
}

export interface AutosaveOptions {
  delayMs?: number;
  nowIso: () => string;
  /** Called once after the first successful save, e.g. to request persistent storage. */
  onFirstSave?: () => void;
}

export interface Autosave {
  notifyChange(): void;
  flush(): Promise<void>;
  /** Re-enables saving after a conflict was resolved (reload or save as copy). */
  resume(): void;
  dispose(): void;
}

function isQuotaError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'QuotaExceededError';
}

/** Debounced saves (plan §4.11): one save at a time; a conflict pauses saving until `resume()`. */
export function createAutosave(
  repo: DesignRepository,
  getSnapshot: () => AutosaveSnapshot,
  onEvent: (event: AutosaveEvent) => void,
  options: AutosaveOptions,
): Autosave {
  const delay = options.delayMs ?? 500;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending = false;
  let running: Promise<void> | null = null;
  let paused = false;
  let disposed = false;
  let firstSaveDone = false;
  let retryAttempt = 0;

  // Backs off 1s, 2s, 4s … up to 60s between retries after a transient failure (plan §3.4 item 6).
  const retryDelayMs = (): number => Math.min(1_000 * 2 ** Math.max(0, retryAttempt - 1), 60_000);

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const run = async (): Promise<void> => {
    clearTimer();
    if (!pending || paused || disposed) return;
    const { doc, baseRevision } = getSnapshot();
    if (!doc) {
      pending = false;
      return;
    }
    pending = false;
    onEvent({ status: 'saving' });
    try {
      const revision = await repo.save({ ...doc, updatedAt: options.nowIso() }, baseRevision);
      retryAttempt = 0;
      onEvent({ status: 'saved', revision, doc });
      if (!firstSaveDone) {
        firstSaveDone = true;
        options.onFirstSave?.();
      }
    } catch (error) {
      if (error instanceof ConflictError) {
        paused = true;
        retryAttempt = 0;
        onEvent({ status: 'conflict', error });
      } else if (error instanceof ReadOnlyError) {
        paused = true;
        retryAttempt = 0;
        onEvent({ status: 'readOnly', error });
      } else if (error instanceof RetryableError) {
        pending = true;
        retryAttempt += 1;
        onEvent({ status: 'offline' });
        scheduleRetry();
      } else {
        onEvent({ status: 'error', error, quota: isQuotaError(error) });
      }
    }
  };

  const start = (): Promise<void> => {
    if (running) return running;
    running = run().finally(() => {
      running = null;
      if (pending && !paused && !disposed && timer === null) schedule();
    });
    return running;
  };

  function schedule() {
    clearTimer();
    timer = setTimeout(() => void start(), delay);
  }

  const scheduleRetry = () => {
    clearTimer();
    timer = setTimeout(() => void start(), retryDelayMs());
  };

  return {
    notifyChange() {
      if (disposed) return;
      pending = true;
      if (!paused && !running) schedule();
    },
    async flush() {
      if (running) await running;
      if (pending) await start();
    },
    resume() {
      paused = false;
      pending = false;
    },
    dispose() {
      disposed = true;
      clearTimer();
    },
  };
}

/** Flushes pending changes when the browser regains connectivity (best effort). */
export function retryOnOnline(autosave: Autosave, win: Window): () => void {
  const listener = () => {
    void autosave.flush();
  };
  win.addEventListener('online', listener);
  return () => {
    win.removeEventListener('online', listener);
  };
}

/** Saves pending changes when the tab is hidden (best effort). */
export function flushOnHidden(autosave: Autosave, doc: Document): () => void {
  const listener = () => {
    if (doc.visibilityState === 'hidden') void autosave.flush();
  };
  doc.addEventListener('visibilitychange', listener);
  return () => {
    doc.removeEventListener('visibilitychange', listener);
  };
}
