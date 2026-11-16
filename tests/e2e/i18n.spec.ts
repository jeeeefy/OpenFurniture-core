import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from './fixtures';
import { createFromTemplate, outlineNode } from './helpers';

async function exportDesign(page: Page, label: string): Promise<{ name: string; text: string }> {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: label, exact: true }).click();
  const download = await downloadPromise;
  return { name: download.suggestedFilename(), text: await readFile(await download.path(), 'utf8') };
}

// `updatedAt` is the save timestamp, not a design value.
const designOf = (text: string) => {
  const design = (JSON.parse(text) as { design: Record<string, unknown> }).design;
  return Object.fromEntries(Object.entries(design).filter(([key]) => key !== 'updatedAt'));
};

test.describe('localisation and browsers (T-027)', () => {
  test('AC-047: EN/DE switch changes UI and document texts, numbers follow the locale, values stay unchanged', async ({ page }) => {
    const id = await createFromTemplate(page, 'blank');
    await outlineNode(page, 'Carcass').click();
    const width = page.getByRole('textbox', { name: /^Width/ });
    await width.fill('1234,5');
    await width.press('Enter');
    await expect(width).toHaveValue('1234.5');
    await expect(page.getByTestId('save-status')).toHaveText('Saved');
    const before = await exportDesign(page, 'Export');
    expect((designOf(before.text).carcass as { widthMm: number }).widthMm).toBe(1234.5);

    await page.getByRole('combobox', { name: 'Language' }).selectOption('de');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(outlineNode(page, 'Korpus')).toBeVisible();
    await expect(page.getByRole('textbox', { name: /^Breite/ })).toHaveValue('1234,5');
    await expect(page.getByRole('heading', { name: 'Gliederung' })).toBeVisible();

    await page.goto(`/#/d/${id}/outputs/cut-list`);
    await expect(page.getByRole('link', { name: 'Zuschnittliste' })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('tr[data-position="3"]')).toContainText('1198,5');
    await expect(page.locator('body')).not.toContainText('1.234');
    await page.goto(`/#/d/${id}/print`);
    await expect(page.getByRole('heading', { name: 'Sicherheit und Hinweise', level: 2 })).toBeVisible();
    await expect(page.locator('.print-facts')).toContainText('1234,5 × 720 × 400 mm');

    await page.goto(`/#/d/${id}`);
    const after = await exportDesign(page, 'Exportieren');
    expect(designOf(after.text)).toEqual(designOf(before.text));

    await page.getByRole('combobox', { name: 'Sprache' }).selectOption('en');
    await outlineNode(page, 'Carcass').click();
    await expect(page.getByRole('textbox', { name: /^Width/ })).toHaveValue('1234.5');
  });

  test('AC-055: create, edit, outputs, print view, export and import @smoke', async ({ page, browser }) => {
    // Renders all step images twice (instructions and print); under full parallel load this exceeds 30 s.
    test.setTimeout(120_000);
    await createFromTemplate(page, 'cabinet');
    await outlineNode(page, 'Carcass').click();
    const width = page.getByRole('textbox', { name: /^Width/ });
    await width.fill('700');
    await width.press('Enter');
    await expect(width).toHaveValue('700');
    await expect(page.getByTestId('save-status')).toHaveText('Saved');

    await page.getByRole('link', { name: /^Outputs/ }).click();
    await expect(page.locator('table').first()).toBeVisible();
    await page.getByRole('link', { name: 'Drilling plans' }).click();
    await expect(page.locator('article.drilling-plan').first()).toBeVisible();
    await page.getByRole('link', { name: 'Instructions' }).click();
    await expect(page.locator('.instructions')).toHaveAttribute('data-images', 'done', { timeout: 60_000 });
    const steps = await page.locator('article.assembly-step').count();
    const illustrated = (await page.getByTestId('step-image').count()) + (await page.getByTestId('step-placeholder').count());
    expect(illustrated).toBe(steps);

    await page.getByRole('link', { name: 'Print / Save as PDF' }).click();
    await expect(page.locator('.print-document')).toHaveAttribute('data-images', 'done', { timeout: 60_000 });
    await expect(page.getByRole('button', { name: 'Print / Save as PDF' })).toBeEnabled();

    await page.getByRole('link', { name: 'Back to the outputs' }).click();
    await page.getByRole('link', { name: 'Back to the editor' }).click();
    const exported = await exportDesign(page, 'Export');
    const fresh = await browser.newContext();
    const other = await fresh.newPage();
    await other.goto('/');
    await other.getByTestId('import-input').setInputFiles({
      name: exported.name,
      mimeType: 'application/json',
      buffer: Buffer.from(exported.text),
    });
    await expect(other).toHaveURL(/#\/d\/[^/]+$/);
    await outlineNode(other, 'Carcass').click();
    await expect(other.getByRole('textbox', { name: /^Width/ })).toHaveValue('700');
    await fresh.close();
  });
});
