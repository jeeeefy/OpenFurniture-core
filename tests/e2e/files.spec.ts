import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from './fixtures';
import { createFromTemplate } from './helpers';

const fixture = (name: string) => path.join(import.meta.dirname, '..', 'fixtures', name);

async function exportFromEditor(page: Page): Promise<{ name: string; text: string }> {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  const filePath = await download.path();
  return { name: download.suggestedFilename(), text: await readFile(filePath, 'utf8') };
}

/** The design without the fields an import replaces. */
function comparable(text: string): unknown {
  const env = JSON.parse(text) as { design: Record<string, unknown> };
  const replaced = new Set(['id', 'name', 'createdAt', 'updatedAt']);
  return Object.fromEntries(Object.entries(env.design).filter(([key]) => !replaced.has(key)));
}

test.describe('design files (T-010)', () => {
  test('export → fresh browser context → import gives the same design (AC-043)', async ({ page, browser }) => {
    await createFromTemplate(page, 'bookcase');
    const exported = await exportFromEditor(page);
    expect(exported.name).toBe('bookcase.furniture.json');

    const fresh = await browser.newContext();
    const other = await fresh.newPage();
    await other.goto('/');
    await other.getByTestId('import-input').setInputFiles({
      name: exported.name,
      mimeType: 'application/json',
      buffer: Buffer.from(exported.text),
    });
    await expect(other).toHaveURL(/#\/d\/[^/]+$/);
    await expect(other.getByRole('heading', { name: 'Bookcase', exact: true })).toBeVisible();
    const reExported = await exportFromEditor(other);
    expect(comparable(reExported.text)).toEqual(comparable(exported.text));
    await fresh.close();
  });

  test('a name clash appends " (imported)"', async ({ page }) => {
    await createFromTemplate(page, 'blank');
    const exported = await exportFromEditor(page);
    await page.goto('/');
    await page.getByTestId('import-input').setInputFiles({
      name: exported.name,
      mimeType: 'application/json',
      buffer: Buffer.from(exported.text),
    });
    await expect(page.getByRole('heading', { name: 'Blank carcass (imported)' })).toBeVisible();
  });

  for (const [file, code] of [
    ['newer-version.furniture.json', 'NEWER_VERSION'],
    ['prototype-keys.furniture.json', 'FORBIDDEN_KEY'],
    ['wrong-format.furniture.json', 'WRONG_FORMAT'],
  ] as const) {
    test(`AC-042: ${code} is rejected without side effects`, async ({ page }) => {
      await createFromTemplate(page, 'blank');
      await page.goto('/');
      await expect(page.locator('.design-item')).toHaveCount(1);
      await page.getByTestId('import-input').setInputFiles(fixture(file));
      const dialog = page.getByRole('dialog', { name: 'The file could not be imported' });
      await expect(dialog.getByTestId('import-error')).toHaveAttribute('data-code', code);
      if (code === 'NEWER_VERSION') await expect(dialog).toContainText('file v2, supported v1');
      await dialog.getByRole('button', { name: 'Close' }).click();
      await page.reload();
      await expect(page.locator('.design-item')).toHaveCount(1);
    });
  }

  test('AC-042: files over 1 MiB and non-JSON files are rejected', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('import-input').setInputFiles({
      name: 'big.json',
      mimeType: 'application/json',
      buffer: Buffer.alloc(1024 * 1024 + 1, 32),
    });
    await expect(page.getByTestId('import-error')).toHaveAttribute('data-code', 'FILE_TOO_LARGE');
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByTestId('import-input').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{ nope') });
    await expect(page.getByTestId('import-error')).toHaveAttribute('data-code', 'NOT_JSON');
    await expect(page.getByText('No designs yet.', { exact: false })).toBeVisible();
  });
});
