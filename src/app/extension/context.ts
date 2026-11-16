import { createContext, useContext } from 'react';
import type { AppExtension } from './types';

export const ExtensionContext = createContext<AppExtension | null>(null);

export function useExtension(): AppExtension | null {
  return useContext(ExtensionContext);
}
