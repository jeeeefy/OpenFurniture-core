import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { Locale } from '@/domain';
import type { DesignRepository } from '@/persistence/types';
import type { AppRoutes } from './router';
import type { EditorState, EditorStore } from './store/editorStore';

export interface AppServices {
  repo: DesignRepository;
  editor: EditorStore;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  newId: () => string;
  nowIso: () => string;
  routes: AppRoutes;
}

export const AppContext = createContext<AppServices | null>(null);

export function useApp(): AppServices {
  const services = useContext(AppContext);
  if (!services) throw new Error('AppContext missing');
  return services;
}

export function useEditor<T>(selector: (state: EditorState) => T): T {
  return useStore(useApp().editor, selector);
}
