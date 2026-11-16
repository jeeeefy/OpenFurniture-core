import { expect, test } from './fixtures';
import { blockWebGL2, createFromTemplate, outlineNode } from './helpers';

test.describe('layout editing and validation (T-013)', () => {
  test('AC-006: adding a divider gives two 373 mm columns; removing a non-empty column needs confirmation', async ({ page }) => {
    await createFromTemplate(page, 'blank');
    await outlineNode(page, 'Carcass').click();
    await page.getByRole('textbox', { name: /^Width/ }).fill('800');
    await page.getByRole('textbox', { name: /^Width/ }).press('Enter');
    await page.getByRole('textbox', { name: /^Depth/ }).fill('400');
    await page.getByRole('textbox', { name: /^Depth/ }).press('Enter');

    await outlineNode(page, 'Column 1').click();
    await page.getByRole('button', { name: 'Add column to the right' }).click();
    await expect(outlineNode(page, 'Column 2')).toHaveAttribute('aria-current', 'true');
    await page.getByRole('radio', { name: 'Fixed' }).check();
    await expect(page.getByRole('textbox', { name: /^Clear width/ })).toHaveValue('373');
    await page.getByRole('button', { name: 'Undo' }).click();

    await outlineNode(page, 'Section 1').last().click();
    await page.getByRole('radio', { name: 'Adjustable shelves' }).check();
    await outlineNode(page, 'Column 2').click();
    await page.getByRole('button', { name: 'Remove column' }).click();
    const dialog = page.getByRole('dialog', { name: 'Remove column 2?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(outlineNode(page, 'Column 2')).toBeVisible();

    await page.getByRole('button', { name: 'Remove column' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Remove column' }).click();
    await expect(outlineNode(page, 'Column 2')).toHaveCount(0);
  });

  test('AC-008 (changed on user request): fixed shelves side by side at the same height are allowed and use angle brackets', async ({ page }) => {
    const id = await createFromTemplate(page, 'blank');
    await outlineNode(page, 'Column 1').click();
    await page.getByRole('button', { name: 'Add column to the right' }).click();

    for (const column of [0, 1]) {
      await outlineNode(page, 'Section 1').nth(column).click();
      await page.getByRole('button', { name: /^Split section/ }).click();
      await outlineNode(page, 'Section 1').nth(column).click();
      await page.getByRole('radio', { name: 'Fixed' }).check();
      await page.getByRole('textbox', { name: /^Clear height/ }).fill('300');
      await page.getByRole('textbox', { name: /^Clear height/ }).press('Enter');
    }
    await expect(page.getByTestId('validation-counts')).toContainText('0 errors');

    await page.goto(`/#/d/${id}/outputs/drilling`);
    await expect(page.locator('td', { hasText: 'Angle bracket under a fixed shelf' }).first()).toBeVisible();
    await page.getByRole('link', { name: 'Instructions' }).click();
    await expect(page.locator('article[data-phase="P2"]')).toContainText('angle brackets underneath');
  });

  test('AC-021: section operations work without WebGL2', async ({ page }) => {
    await blockWebGL2(page);
    await createFromTemplate(page, 'blank');
    await outlineNode(page, 'Section 1').click();
    await page.getByRole('button', { name: /^Split section/ }).click();
    await expect(outlineNode(page, 'Section 2')).toBeVisible();
    await outlineNode(page, 'Section 2').click();
    await page.getByRole('radio', { name: 'Clothes rail' }).check();
    await outlineNode(page, 'Section 1').click();
    await page.getByRole('button', { name: 'Merge with the section above' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Merge with the section above' }).click();
    await expect(outlineNode(page, 'Section 2')).toHaveCount(0);
    await outlineNode(page, 'Column 1').click();
    await page.getByRole('button', { name: 'Add column to the left' }).click();
    await expect(outlineNode(page, 'Column 2')).toBeVisible();
  });
});
