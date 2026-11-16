import { useEffect, useState } from 'react';

export const OUTPUT_TABS = ['cut-list', 'cutting', 'hardware', 'drilling', 'instructions'] as const;
export type OutputTab = (typeof OUTPUT_TABS)[number];

export type Route =
  | { name: 'start' }
  | { name: 'editor'; designId: string }
  | { name: 'outputs'; designId: string; tab: OutputTab }
  | { name: 'print'; designId: string }
  | { name: 'settings' }
  | { name: 'imprint' }
  | { name: 'ext'; path: string; query: string }
  | { name: 'not-found' };

const isTab = (value: string): value is OutputTab => (OUTPUT_TABS as readonly string[]).includes(value);

/**
 * Static hosts in SPA mode serve `index.html` for unknown paths, so the app must
 * decide whether the current path is a real page. All app routes live in the
 * hash, so the only valid page paths are the deployment base and its index file.
 */
export function isAppPath(pathname: string, base: string = import.meta.env.BASE_URL): boolean {
  const basePath = base.endsWith('/') ? base : `${base}/`;
  return pathname === basePath || pathname === basePath.slice(0, -1) || pathname === `${basePath}index.html`;
}

/** Plan §5.6 hash routes; an invalid outputs tab falls back to the cut list. */
export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  if (path === '/') return { name: 'start' };
  if (path === '/settings') return { name: 'settings' };
  if (path === '/imprint') return { name: 'imprint' };
  if (path === '/ext' || path.startsWith('/ext/')) {
    const rest = path.slice('/ext'.length);
    const trimmed = rest.startsWith('/') ? rest.slice(1) : rest;
    const q = trimmed.indexOf('?');
    return {
      name: 'ext',
      path: q === -1 ? trimmed : trimmed.slice(0, q),
      query: q === -1 ? '' : trimmed.slice(q + 1),
    };
  }
  const parts = path.split('/').slice(1).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return '';
    }
  });
  if (parts[0] === 'd' && parts[1]) {
    const designId = parts[1];
    if (parts.length === 2) return { name: 'editor', designId };
    if (parts[2] === 'outputs' && parts.length <= 4) {
      const tab = parts[3] ?? '';
      return { name: 'outputs', designId, tab: isTab(tab) ? tab : 'cut-list' };
    }
    if (parts[2] === 'print' && parts.length === 3) return { name: 'print', designId };
  }
  return { name: 'not-found' };
}

export function routeHref(route: Route): string {
  switch (route.name) {
    case 'start':
    case 'not-found':
      return '#/';
    case 'settings':
      return '#/settings';
    case 'imprint':
      return '#/imprint';
    case 'editor':
      return `#/d/${encodeURIComponent(route.designId)}`;
    case 'outputs':
      return `#/d/${encodeURIComponent(route.designId)}/outputs/${route.tab}`;
    case 'print':
      return `#/d/${encodeURIComponent(route.designId)}/print`;
    case 'ext':
      return `#/ext/${route.path}${route.query ? `?${route.query}` : ''}`;
  }
}

export interface AppRoutes {
  start(): string;
  editor(id: string): string;
  outputs(id: string, tab: OutputTab): string;
  print(id: string): string;
}

/** Core route builders (plan §3.4 item 3); an extension may replace these via `AppServices.routes`. */
export function coreRoutes(): AppRoutes {
  return {
    start: () => routeHref({ name: 'start' }),
    editor: (id) => routeHref({ name: 'editor', designId: id }),
    outputs: (id, tab) => routeHref({ name: 'outputs', designId: id, tab }),
    print: (id) => routeHref({ name: 'print', designId: id }),
  };
}

export function navigate(route: Route): void {
  window.location.hash = routeHref(route);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
    };
    window.addEventListener('hashchange', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
    };
  }, []);
  return route;
}
