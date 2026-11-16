import { createStore } from 'zustand/vanilla';
import type { DesignDocument, Operation, OpRejection, OpResult } from '@/domain';
import { EMPTY_HISTORY, record, redo, undo, type History } from './history';
import { selectionExists, type Selection } from './selectors';

export type SaveStatus =
  | 'saved'
  | 'savedRemote'
  | 'saving'
  | 'dirty'
  | 'offline'
  | 'error'
  | 'readOnly'
  | 'conflict';

export interface ViewOptions {
  showFronts: boolean;
  showBack: boolean;
}

export interface EditorState {
  doc: DesignDocument | null;
  /** Revision of the stored record this document is based on. */
  baseRevision: number;
  selection: Selection | null;
  /** Part id under the pointer in 3D. */
  hover: string | null;
  viewOptions: ViewOptions;
  saveStatus: SaveStatus;
  lastRejection: OpRejection | null;
  /** Per open design; cleared on load (design switch, import, reload). */
  history: History;
  /** Field the inspector should focus after rendering (validation panel links). */
  focusRequest: { fieldId: string; nonce: number } | null;
  /** Target set by "Fix in editor" links; applied once the editor has loaded the design. */
  pendingTarget: { designId: string; selection: Selection | null; fieldId: string | null } | null;

  load: (doc: DesignDocument, revision: number) => void;
  close: () => void;
  commit: <A>(op: Operation<A>, args: A) => OpResult;
  undo: () => boolean;
  redo: () => boolean;
  select: (selection: Selection | null) => void;
  requestFocus: (fieldId: string) => void;
  setPendingTarget: (target: EditorState['pendingTarget']) => void;
  setHover: (partId: string | null) => void;
  setViewOptions: (options: Partial<ViewOptions>) => void;
  setSaveStatus: (status: SaveStatus) => void;
  markSaved: (revision: number, savedDoc: DesignDocument) => void;
}

export type EditorStore = ReturnType<typeof createEditorStore>;

export function createEditorStore() {
  return createStore<EditorState>()((set, get) => {
    const replaceDoc = (doc: DesignDocument, history: History) => {
      const { selection } = get();
      set({
        doc,
        history,
        lastRejection: null,
        saveStatus: 'dirty',
        selection: selection && selectionExists(doc, selection) ? selection : null,
      });
    };

    return {
      doc: null,
      baseRevision: 0,
      selection: null,
      hover: null,
      viewOptions: { showFronts: true, showBack: true },
      saveStatus: 'saved',
      lastRejection: null,
      history: EMPTY_HISTORY,
      focusRequest: null,
      pendingTarget: null,

      load: (doc, revision) => {
        set({
          doc,
          baseRevision: revision,
          selection: null,
          hover: null,
          saveStatus: 'saved',
          lastRejection: null,
          history: EMPTY_HISTORY,
        });
      },

      close: () => {
        set({ doc: null, baseRevision: 0, selection: null, hover: null, lastRejection: null, history: EMPTY_HISTORY });
      },

      commit: (op, args) => {
        const { doc, history } = get();
        if (!doc) {
          set({ lastRejection: 'not-found' });
          return { ok: false, reason: 'not-found' };
        }
        const result = op(doc, args);
        if (!result.ok) {
          set({ lastRejection: result.reason });
          return result;
        }
        replaceDoc(result.doc, record(history, doc));
        return result;
      },

      undo: () => {
        const { doc, history } = get();
        const step = doc ? undo(history, doc) : null;
        if (!step) return false;
        replaceDoc(step.doc, step.history);
        return true;
      },

      redo: () => {
        const { doc, history } = get();
        const step = doc ? redo(history, doc) : null;
        if (!step) return false;
        replaceDoc(step.doc, step.history);
        return true;
      },

      select: (selection) => {
        set({ selection });
      },
      requestFocus: (fieldId) => {
        set({ focusRequest: { fieldId, nonce: (get().focusRequest?.nonce ?? 0) + 1 } });
      },
      setPendingTarget: (pendingTarget) => {
        set({ pendingTarget });
      },
      setHover: (hover) => {
        set({ hover });
      },
      setViewOptions: (options) => {
        set({ viewOptions: { ...get().viewOptions, ...options } });
      },
      setSaveStatus: (saveStatus) => {
        set({ saveStatus });
      },
      markSaved: (revision, savedDoc) => {
        set({ baseRevision: revision, saveStatus: get().doc === savedDoc ? 'saved' : 'dirty' });
      },
    };
  });
}
