import { IMPRINT } from '../../src/app/legal';
import { expect, test } from './fixtures';
import { createFromTemplate } from './helpers';

test.describe('settings, imprint and editor title', () => {
  test('settings shows a sticky back arrow and links to the imprint', async ({ page }) => {
    await page.goto('/#/settings');
    const back = page.getByRole('link', { name: 'Back to the main menu' });
    await expect(back).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const box = await back.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeLessThan(200);

    await page.getByRole('link', { name: 'Imprint' }).click();
    await expect(page).toHaveURL(/#\/imprint$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Imprint' })).toBeVisible();
    await expect(page.getByText(IMPRINT.name).first()).toBeVisible();
    await expect(page.getByText(IMPRINT.street).first()).toBeVisible();
    await expect(page.getByRole('link', { name: IMPRINT.email })).toBeVisible();
  });

  test('clicking the editor title renames the design and survives reload', async ({ page }) => {
    const id = await createFromTemplate(page, 'blank');
    await page.getByRole('button', { name: 'Blank carcass', exact: true }).click();
    const input = page.getByLabel('Design name');
    await input.fill('Werkstattregal');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { level: 2, name: /Werkstattregal/ })).toBeVisible();
    await expect(page.getByTestId('save-status')).toHaveText('Saved');

    await page.reload();
    await expect(page.getByRole('heading', { level: 2, name: /Werkstattregal/ })).toBeVisible();
    await page.goto('/');
    await expect(page.locator(`[data-design-id="${id}"]`)).toContainText('Werkstattregal');
  });
});
