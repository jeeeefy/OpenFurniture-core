import type { AppExtension } from './types';

let promise: Promise<AppExtension | null> | null = null;

/** Lazily loads the extension once; resolves to null in the core build. */
export function loadExtension(): Promise<AppExtension | null> {
  if (!promise) {
    promise = import('@/app/extension/entry').then((mod) => mod.default ?? null);
  }
  return promise;
}
