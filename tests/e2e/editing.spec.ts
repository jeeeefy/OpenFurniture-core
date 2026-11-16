import { expect, test, type Page } from './fixtures';
import { blockWebGL2, createFromTemplate, outlineNode } from './helpers';

async function setWidth(page: Page, value: string) {
  await outlineNode(page, 'Carcass').click();
  const width = page.getByRole('textbox', { name: /^Width/ });
  await width.fill(value);
  await width.press('Enter');
}

test.describe('editing (T-011, T-012, T-009)', () => {
  test('T-012: a width change updates the 3D view and keeps the camera (AC-020)', async ({ page }) => {
    await createFromTemplate(page, 'blank');
    const canvas = page.getByTestId('viewport-canvas');
    await expect(canvas).toHaveAttribute('data-camera', /.+/);
    const camera = await canvas.getAttribute('data-camera');
    await setWidth(page, '900');
    await expect(canvas).toHaveAttribute('aria-label', /900 × 720 × 400 mm/);
    await expect(canvas).toHaveAttribute('data-camera', camera ?? '');
  });

  test('AC-038: edits are autosaved within 1 s and restored after reload', async ({ page }) => {
    await createFromTemplate(page, 'blank');
    await setWidth(page, '750');
    await expect(page.getByTestId('save-status')).toHaveText('Saved', { timeout: 1500 });
    await page.reload();
    await expect(page.getByTestId('save-status')).toHaveText('Saved');
    await outlineNode(page, 'Carcass').click();
    await expect(page.getByRole('textbox', { name: /^Width/ })).toHaveValue('750');
  });

  test('AC-049: Ctrl+Z and Ctrl+Shift+Z outside text fields; toolbar buttons', async ({ page }) => {
    await createFromTemplate(page, 'blank');
    await setWidth(page, '700');
    const width = page.getByRole('textbox', { name: /^Width/ });
    await expect(width).toHaveValue('700');
    await outlineNode(page, 'Carcass').focus();
    await page.keyboard.press('Control+z');
    await expect(width).toHaveValue('600');
    await page.keyboard.press('Control+Shift+z');
    await expect(width).toHaveValue('700');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(width).toHaveValue('600');
    await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  test('AC-046: a second tab detects the revision conflict and offers Reload or Save as copy', async ({ page, context }) => {
    const id = await createFromTemplate(page, 'blank');
    const second = await context.newPage();
    await second.goto(`/#/d/${id}`);
    await expect(second.getByTestId('save-status')).toHaveText('Saved');

    await setWidth(page, '700');
    await expect(page.getByTestId('save-status')).toHaveText('Saved');

    await setWidth(second, '800');
    await expect(second.getByTestId('save-status')).toHaveText('Changed in another tab');
    await second.getByRole('button', { name: 'Reload' }).click();
    await expect(second.getByTestId('save-status')).toHaveText('Saved');
    await outlineNode(second, 'Carcass').click();
    await expect(second.getByRole('textbox', { name: /^Width/ })).toHaveValue('700');

    await setWidth(page, '650');
    await expect(page.getByTestId('save-status')).toHaveText('Saved');
    await setWidth(second, '820');
    await expect(second.getByTestId('save-status')).toHaveText('Changed in another tab');
    await second.getByRole('button', { name: 'Save as copy' }).click();
    await expect(second.getByRole('heading', { name: 'Copy of Blank carcass' })).toBeVisible();
    await outlineNode(second, 'Carcass').click();
    await expect(second.getByRole('textbox', { name: /^Width/ })).toHaveValue('820');
    await expect(second.getByTestId('save-status')).toHaveText('Saved');
  });

  test('AC-021: without WebGL2 the carcass can still be edited through outline and inspector', async ({ page }) => {
    await blockWebGL2(page);
    await createFromTemplate(page, 'blank');
    await expect(page.getByTestId('viewport-fallback')).toBeVisible();
    await setWidth(page, '640');
    await page.getByRole('textbox', { name: /^Height/ }).fill('800');
    await page.getByRole('textbox', { name: /^Height/ }).press('Enter');
    await page.getByRole('radio', { name: 'Plinth', exact: true }).check();
    await page.getByRole('radio', { name: 'Screws' }).check();
    await page.getByRole('combobox', { name: /^Back panel/ }).selectOption('mat-ply-6');
    await expect(page.getByTestId('save-status')).toHaveText('Saved');
    await page.reload();
    await outlineNode(page, 'Plinth').click();
    await expect(page.getByRole('textbox', { name: /^Width/ })).toHaveValue('640');
    await expect(page.getByRole('radio', { name: 'Screws' })).toBeChecked();
  });
});
