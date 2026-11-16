import { expect, test } from './fixtures';
import { blockWebGL2, createFromTemplate } from './helpers';

test.describe('instructions (T-023)', () => {
  test('AC-034: sideboard steps each have a PNG illustration, parts, hardware, tools and orientation', async ({ page }) => {
    const id = await createFromTemplate(page, 'sideboard');
    await page.goto(`/#/d/${id}/outputs/instructions`);
    await expect(page.locator('.instructions')).toHaveAttribute('data-images', 'done', { timeout: 30_000 });
    const steps = page.locator('article.assembly-step');
    const count = await steps.count();
    expect(count).toBeGreaterThan(8);
    await expect(page.getByTestId('step-image')).toHaveCount(count);
    const src = await page.getByTestId('step-image').first().getAttribute('src');
    expect(src?.startsWith('data:image/png;base64,')).toBe(true);
    await expect(page.getByTestId('step-placeholder')).toHaveCount(0);
    await expect(page.getByTestId('tools-list')).toContainText('Forstner bit Ø35 mm');
    const drawers = page.locator('article[data-phase="P10"]');
    await expect(drawers).toContainText('Drawer front');
    await expect(drawers.getByTestId('step-hardware')).toContainText('pairs');
    await expect(drawers).toContainText('Upright');
  });

  test('AC-021: without WebGL2 the steps show placeholders', async ({ page }) => {
    await blockWebGL2(page);
    const id = await createFromTemplate(page, 'bookcase');
    await page.goto(`/#/d/${id}/outputs/instructions`);
    await expect(page.locator('.instructions')).toHaveAttribute('data-images', 'done');
    const count = await page.locator('article.assembly-step').count();
    expect(count).toBeGreaterThan(5);
    await expect(page.getByTestId('step-placeholder')).toHaveCount(count);
    await expect(page.getByTestId('step-image')).toHaveCount(0);
    await expect(page.getByTestId('step-placeholder').first()).toContainText('Illustration not available');
  });
});
