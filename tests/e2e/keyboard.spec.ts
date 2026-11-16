import { expect, test, type Page } from './fixtures';
import { outlineNode } from './helpers';
import type { Locator } from '@playwright/test';

/** Presses Tab until the target has focus; fails if it is not reachable in visual tab order. */
async function tabTo(page: Page, target: Locator, max = 250): Promise<void> {
  await expect(target).toBeAttached({ timeout: 2000 });
  for (let i = 0; i < max; i += 1) {
    if (await target.evaluate((el) => el === document.activeElement, undefined, { timeout: 1000 })) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Not reachable by Tab: ${target.toString()}`);
}

/** Select-all is Cmd+A on macOS; Ctrl+A only moves the caret there. */
const SELECT_ALL = process.platform === 'darwin' ? 'Meta+a' : 'Control+a';

async function typeInto(page: Page, field: Locator, value: string): Promise<void> {
  await tabTo(page, field);
  await page.keyboard.press(SELECT_ALL);
  await page.keyboard.type(value);
  await page.keyboard.press('Enter');
}

test.describe('keyboard only (T-027, AC-051)', () => {
  test('J-1 plus one operation per group without the mouse', async ({ page }) => {
    await page.goto('/');
    await tabTo(page, page.locator('[data-template="blank"]'));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/d\/[^/]+$/);
    await expect(page.getByTestId('save-status')).toBeVisible();

    // Carcass
    await tabTo(page, outlineNode(page, 'Carcass'));
    await page.keyboard.press('Enter');
    await typeInto(page, page.getByRole('textbox', { name: /^Width/ }), '800');
    await expect(page.getByRole('textbox', { name: /^Width/ })).toHaveValue('800');

    // Column
    await tabTo(page, outlineNode(page, 'Column 1'));
    await page.keyboard.press('Enter');
    await tabTo(page, page.getByRole('button', { name: 'Add column to the right' }));
    await page.keyboard.press('Enter');
    await expect(outlineNode(page, 'Column 2')).toBeVisible();

    // Section
    await tabTo(page, outlineNode(page, 'Section 1').first());
    await page.keyboard.press('Enter');
    await tabTo(page, page.getByRole('button', { name: /^Split section/ }));
    await page.keyboard.press('Enter');
    await expect(outlineNode(page, 'Section 2').first()).toBeVisible();

    // Front: arrow keys move through None → Single door → Double door → Drawers.
    await tabTo(page, outlineNode(page, 'Section 1').first());
    await page.keyboard.press('Enter');
    await tabTo(page, page.getByRole('radio', { name: 'No front', exact: true }));
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('radio', { name: 'Single door' })).toBeChecked();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('radio', { name: 'Drawers', exact: true })).toBeChecked();
    await expect(outlineNode(page, 'Drawer 3')).toBeVisible();

    // Drawers
    await tabTo(page, outlineNode(page, 'Drawer 1'));
    await page.keyboard.press('Enter');
    await tabTo(page, page.getByRole('radio', { name: 'Automatic' }));
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('radio', { name: 'Fixed' })).toBeChecked();

    // Material
    await tabTo(page, outlineNode(page, 'Materials'));
    await page.keyboard.press('Enter');
    await tabTo(page, page.locator('summary', { hasText: 'Birch plywood 18 mm' }));
    await page.keyboard.press('Enter');
    await typeInto(page, page.locator('#field-material-mat-ply-18-thicknessMm'), '19');
    await expect(page.locator('#field-material-mat-ply-18-thicknessMm')).toHaveValue('19');

    // Hardware profile
    await tabTo(page, outlineNode(page, 'Hardware profiles'));
    await page.keyboard.press('Enter');
    await tabTo(page, page.locator('summary', { hasText: 'Concealed hinge' }));
    await page.keyboard.press('Enter');
    const verified = page.locator('#field-profile-hinge-generic-35-verified');
    await tabTo(page, verified);
    await page.keyboard.press('Space');
    await expect(verified).toBeChecked();

    // Undo/redo: shortcuts outside text fields, then the toolbar button.
    await page.keyboard.press('Control+z');
    await expect(verified).not.toBeChecked();
    await page.keyboard.press('Control+Shift+z');
    await expect(verified).toBeChecked();
    await tabTo(page, page.getByRole('button', { name: 'Undo' }));
    await page.keyboard.press('Enter');
    await expect(verified).not.toBeChecked();

    // Outputs and print view
    await tabTo(page, page.getByRole('link', { name: /^Outputs/ }));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/outputs\/cut-list$/);
    await tabTo(page, page.getByRole('link', { name: 'Drilling plans' }));
    await page.keyboard.press('Enter');
    await expect(page.locator('article.drilling-plan').first()).toBeVisible();
    await tabTo(page, page.getByRole('link', { name: 'Print / Save as PDF' }));
    await page.keyboard.press('Enter');
    await expect(page.locator('.print-document')).toHaveAttribute('data-images', 'done', { timeout: 30_000 });
    const print = page.getByRole('button', { name: 'Print / Save as PDF' });
    await tabTo(page, print);
    await expect(print).toBeEnabled();
  });
});
