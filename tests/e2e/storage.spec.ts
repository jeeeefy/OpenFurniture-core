import { expect, test } from './fixtures';
import { createFromTemplate } from './helpers';

test.describe('local storage (T-009)', () => {
  test('a new design is stored and restored after reload with status "Saved"', async ({ page }) => {
    const id = await createFromTemplate(page, 'blank');
    await expect(page.getByTestId('save-status')).toHaveText('Saved');
    await page.reload();
    await expect(page.getByTestId('save-status')).toHaveText('Saved');
    await page.goto('/');
    await expect(page.locator(`[data-design-id="${id}"]`)).toContainText('Blank carcass');
  });

  test('AC-039: rename, duplicate and delete with confirmation', async ({ page }) => {
    const id = await createFromTemplate(page, 'blank');
    await page.goto('/');
    const item = page.locator(`[data-design-id="${id}"]`);

    await item.getByRole('button', { name: 'Rename' }).click();
    await item.getByRole('textbox').fill('Hall cabinet');
    await item.getByRole('button', { name: 'Save' }).click();
    await expect(item).toContainText('Hall cabinet');

    await item.getByRole('button', { name: 'Duplicate' }).click();
    const copy = page.locator('.design-item', { hasText: 'Copy of Hall cabinet' });
    await expect(copy).toHaveCount(1);
    await expect(page.locator('.design-item')).toHaveCount(2);

    await item.getByRole('button', { name: 'Delete' }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete “Hall cabinet”?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('.design-item')).toHaveCount(2);

    await item.getByRole('button', { name: 'Delete' }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.design-item')).toHaveCount(2);

    await item.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.locator('.design-item')).toHaveCount(1);
    await expect(page.locator('.design-item')).toContainText('Copy of Hall cabinet');
    await page.reload();
    await expect(page.locator('.design-item')).toHaveCount(1);
  });

  test('AC-045: without IndexedDB the app runs memory-only with a banner', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });
    });
    await page.goto('/');
    await expect(page.getByTestId('memory-banner')).toBeVisible();
    await createFromTemplate(page, 'blank');
    await expect(page.getByTestId('memory-banner')).toBeVisible();
    await expect(page.getByTestId('save-status')).toHaveText('Saved');
  });
});
