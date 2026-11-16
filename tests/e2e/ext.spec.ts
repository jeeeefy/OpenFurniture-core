import { expect, test } from './fixtures';

test.describe('extension route (AC-104)', () => {
  test('an extension route shows not-found in the core build and no account links', async ({ page }) => {
    await page.goto('/#/ext/pricing');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();

    await expect(page.getByRole('link', { name: 'Account / Pro' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Pricing' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Imprint' })).toHaveCount(0);
  });
});
