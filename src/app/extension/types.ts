import type { ComponentType, ReactNode } from 'react';

/** Extension surface (plan §3.4 item 2). The core build ships `null`. */
export interface AppExtension {
  /** Renders a page for `#/ext/<path>`, or returns null to fall back to not-found. */
  route(path: string, query: URLSearchParams): ReactNode | null;
  EditorActions?: ComponentType<{ designId: string }>;
  OutputsActions?: ComponentType<{ designId: string }>;
  StartSection?: ComponentType;
  HeaderMenu?: ComponentType;
}
