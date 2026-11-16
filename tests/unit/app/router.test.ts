import { describe, expect, it } from 'vitest';
import { isAppPath, parseHash, routeHref } from '@/app/router';
import { coreRoutes } from '@/app/router';

describe('router', () => {
  it('parses and builds the imprint route', () => {
    expect(parseHash('#/imprint')).toEqual({ name: 'imprint' });
    expect(routeHref({ name: 'imprint' })).toBe('#/imprint');
  });

  it('parses and builds the ext route', () => {
    expect(parseHash('#/ext/pricing')).toEqual({ name: 'ext', path: 'pricing', query: '' });
    expect(parseHash('#/ext/a/b?x=1')).toEqual({ name: 'ext', path: 'a/b', query: 'x=1' });
    expect(routeHref({ name: 'ext', path: 'pricing', query: '' })).toBe('#/ext/pricing');
    expect(routeHref({ name: 'ext', path: 'pricing', query: 'x=1' })).toBe('#/ext/pricing?x=1');
  });

  it('builds the core routes', () => {
    expect(coreRoutes().start()).toBe('#/');
    expect(coreRoutes().editor('abc')).toBe('#/d/abc');
    expect(coreRoutes().outputs('abc', 'cut-list')).toBe('#/d/abc/outputs/cut-list');
    expect(coreRoutes().print('abc')).toBe('#/d/abc/print');
  });

  it('only accepts the deployment base as an app path', () => {
    expect(isAppPath('/', '/')).toBe(true);
    expect(isAppPath('/index.html', '/')).toBe(true);
    expect(isAppPath('/does-not-exist', '/')).toBe(false);
    expect(isAppPath('/sub/', '/sub/')).toBe(true);
    expect(isAppPath('/sub', '/sub/')).toBe(true);
    expect(isAppPath('/sub/index.html', '/sub/')).toBe(true);
    expect(isAppPath('/other', '/sub/')).toBe(false);
  });
});
