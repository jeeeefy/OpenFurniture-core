import { expect, type Page } from '@playwright/test';

/** Creates a design from a template card on the start page and waits for the editor. */
export async function createFromTemplate(page: Page, template: string): Promise<string> {
  await page.goto('/');
  await page.locator(`[data-template="${template}"]`).click();
  await expect(page).toHaveURL(/#\/d\/[^/]+$/);
  await expect(page.getByTestId('save-status')).toBeVisible();
  return decodeURIComponent(page.url().split('#/d/')[1] ?? '');
}

export function outlineNode(page: Page, label: string) {
  return page.getByRole('navigation', { name: /Outline|Gliederung/ }).getByRole('button', { name: label, exact: true });
}

export async function blockWebGL2(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const original = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext')?.value as (
      this: HTMLCanvasElement,
      ...args: unknown[]
    ) => unknown;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value(this: HTMLCanvasElement, type: string, ...args: unknown[]) {
        return type === 'webgl2' ? null : original.call(this, type, ...args);
      },
    });
  });
}
