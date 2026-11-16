import { expect, test as base } from '@playwright/test';

export { expect };
export type { Page } from '@playwright/test';

/**
 * Every E2E test runs with two guards:
 * AC-052 – no request may target another origin; AC-054 – no CSP violation may be reported.
 */
export const test = base.extend<{ securityGuards: undefined }>({
  securityGuards: [
    async ({ context, baseURL }, use) => {
      const origin = new URL(baseURL ?? 'http://localhost:4173').origin;
      const foreign: string[] = [];
      const violations: string[] = [];
      context.on('request', (request) => {
        const url = request.url();
        if (/^(https?|wss?):/.test(url) && new URL(url).origin !== origin) foreign.push(url);
      });
      await context.exposeBinding('__fdReportCsp', (_source, text: string) => {
        violations.push(text);
      });
      await context.addInitScript(() => {
        const report = (window as unknown as { __fdReportCsp: (text: string) => Promise<void> }).__fdReportCsp;
        document.addEventListener('securitypolicyviolation', (e) => {
          void report(`${e.violatedDirective} ${e.blockedURI}`);
        });
      });
      await use(undefined);
      expect(foreign, 'requests to other origins (AC-052)').toEqual([]);
      expect(violations, 'CSP violations (AC-054)').toEqual([]);
    },
    { auto: true },
  ],
});
