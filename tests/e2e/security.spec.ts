import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from './fixtures';
import { createFromTemplate } from './helpers';

const XSS = '<img src=x onerror=alert(1)>';

async function exportedDesign(page: Page): Promise<{ design: { name: string; materials: { name: string }[] } }> {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  return JSON.parse(await readFile(await download.path(), 'utf8')) as { design: { name: string; materials: { name: string }[] } };
}

async function noInjectedImage(page: Page): Promise<void> {
  expect(await page.locator('img[src="x"]').count()).toBe(0);
}

test.describe('security (T-026)', () => {
  test('AC-053 / AC-054: XSS names stay text through import, editor, all outputs, print and settings', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });

    await createFromTemplate(page, 'sideboard');
    const file = await exportedDesign(page);
    file.design.name = XSS;
    for (const material of file.design.materials) material.name = `${XSS} ${material.name}`;

    await page.goto('/');
    await page.getByTestId('import-input').setInputFiles({
      name: 'xss.furniture.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(file)),
    });
    await expect(page).toHaveURL(/#\/d\/[^/]+$/);
    const id = decodeURIComponent(page.url().split('#/d/')[1] ?? '');
    await expect(page.getByRole('heading', { name: XSS, exact: true })).toBeVisible();
    await noInjectedImage(page);

    // Viewport resize while the editor shows the 3D view.
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.setViewportSize({ width: 1400, height: 900 });

    for (const tab of ['cut-list', 'hardware', 'drilling', 'instructions']) {
      await page.goto(`/#/d/${id}/outputs/${tab}`);
      await expect(page.getByRole('heading', { name: `Outputs – ${XSS}` })).toBeVisible();
      if (tab === 'instructions') await expect(page.locator('.instructions')).toHaveAttribute('data-images', 'done', { timeout: 30_000 });
      await noInjectedImage(page);
    }
    await page.goto(`/#/d/${id}/outputs/cut-list`);
    await expect(page.locator('caption').first()).toContainText(XSS);
    await page.goto(`/#/d/${id}/outputs/drilling`);
    await expect(page.locator('article.drilling-plan p').nth(0)).toContainText(XSS);

    await page.goto(`/#/d/${id}/print`);
    await expect(page.locator('.print-document')).toHaveAttribute('data-images', 'done', { timeout: 30_000 });
    await expect(page.locator('.print-title')).toHaveText(XSS);
    await expect(page.locator('.print-footer').first()).toContainText(XSS);
    await noInjectedImage(page);

    await page.goto('/');
    await expect(page.locator(`[data-design-id="${id}"]`)).toContainText(XSS);
    await noInjectedImage(page);
    expect(dialogs).toEqual([]);
  });

  test('settings list the production licences and ship their texts', async ({ page, request }) => {
    await page.goto('/#/settings');
    const list = page.getByTestId('licence-list');
    for (const name of ['react', 'react-dom', 'three', 'zod', 'zustand', 'idb']) {
      await expect(list.getByRole('cell', { name, exact: true })).toBeVisible();
    }
    const link = page.getByRole('link', { name: /Full licence texts/ });
    const href = await link.getAttribute('href');
    const response = await request.get(href ?? '');
    expect(response.ok()).toBe(true);
    const text = await response.text();
    expect(text).toContain('three@0.187.0 – MIT');
    expect(text).toContain('Permission is hereby granted');
  });
});
