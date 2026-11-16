import { expect, test } from './fixtures';
import { createFromTemplate } from './helpers';

test.describe('drilling plans (T-021)', () => {
  test('sideboard: plans with hole tables, banner and scaled SVG without page overflow', async ({ page }) => {
    const id = await createFromTemplate(page, 'sideboard');
    await page.goto(`/#/d/${id}/outputs/drilling`);
    const plans = page.locator('article.drilling-plan');
    await expect(plans.first()).toBeVisible();
    expect(await plans.count()).toBeGreaterThan(3);
    await expect(page.getByTestId('unverified-banner').first()).toBeVisible();

    const firstFace = plans.first().locator('section.drilling-face').first();
    const svgRefs = await firstFace.locator('svg [data-ref]').count();
    await expect(firstFace.locator('tbody tr')).toHaveCount(svgRefs);
    await expect(firstFace.locator('svg')).toContainText('0,0');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
