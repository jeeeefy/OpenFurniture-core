import { useEffect, useState } from 'react';
import type { DesignDocument } from '@/domain';
import { useApp } from './context';

export type DesignLoadState = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; doc: DesignDocument };

/** The open editor document if it matches, otherwise the stored design. */
export function useDesignDocument(designId: string): DesignLoadState {
  const { repo, editor } = useApp();
  const [state, setState] = useState<DesignLoadState>(() => {
    const current = editor.getState().doc;
    return current?.id === designId ? { status: 'ready', doc: current } : { status: 'loading' };
  });

  useEffect(() => {
    if (state.status !== 'loading') return;
    let cancelled = false;
    void repo.get(designId).then((loaded) => {
      if (cancelled) return;
      setState(loaded?.status === 'ok' ? { status: 'ready', doc: loaded.document } : { status: 'missing' });
    });
    return () => {
      cancelled = true;
    };
  }, [repo, designId, state.status]);

  return state;
}
