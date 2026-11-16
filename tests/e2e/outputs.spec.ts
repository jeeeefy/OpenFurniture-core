import { expect, test } from './fixtures';
import { createFromTemplate, outlineNode } from './helpers';

test.describe('outputs page (T-015)', () => {
  test('AC-027 / warnings only: bookcase cut list, hardware and warnings are shown', async ({ page }) => {
    const id = await createFromTemplate(page, 'bookcase');
    await page.getByRole('link', { name: /^Outputs/ }).click();
    await expect(page).toHaveURL(new RegExp(`#/d/${id}/outputs/cut-list$`));
    await expect(page.getByTestId('outputs-warnings')).toContainText('anchor it to the wall');

    const ply = page.locator('table[data-material="mat-ply-18"]');
    await expect(ply.locator('tbody tr')).toHaveCount(7);
    await expect(ply.locator('tr[data-position="1"]')).toContainText('Side left');
    await expect(ply.locator('tr[data-position="1"]')).toContainText('2000 × 297 × 18');
    await expect(ply.locator('tr[data-position="6"]')).toContainText('Fixed shelf');
    await expect(ply.locator('tr[data-position="6"] td').nth(2)).toHaveText('4');
    await expect(page.locator('table[data-material="mat-hdf-3"] tr[data-position="8"]')).toContainText('Back panel');
    await expect(page.getByTestId('edge-band-totals')).toContainText('11.6 m');
    // Back panel 2000 × 800: 1.60 m² (price estimate per material).
    await expect(page.locator('[data-testid="material-areas"] tr[data-material="mat-hdf-3"]')).toContainText('1.60 m²');

    await page.getByRole('link', { name: 'Hardware' }).click();
    await expect(page.locator('tr[data-key="edge-band:mat-ply-18"]')).toContainText('Pos. 1, 2, 3, 4, 5, 6, 7');
    await expect(page.locator('tr[data-key="wall-anchor"]')).toBeVisible();

    await page.getByRole('combobox', { name: 'Language' }).selectOption('de');
    await expect(page.locator('tr[data-key="edge-band:mat-ply-18"]')).toContainText('11,6 m');
    await page.getByRole('link', { name: 'Zuschnittliste' }).click();
    await expect(page.getByTestId('edge-band-totals')).toContainText('11,6 m');
  });

  test('T-012: changing the width updates the cut list', async ({ page }) => {
    const id = await createFromTemplate(page, 'blank');
    await outlineNode(page, 'Carcass').click();
    await page.getByRole('textbox', { name: /^Width/ }).fill('900');
    await page.getByRole('textbox', { name: /^Width/ }).press('Enter');
    await page.goto(`/#/d/${id}/outputs/cut-list`);
    // Blank: 400 deep with a 3 mm HDF back → Dc 397.
    await expect(page.locator('tr[data-position="3"]')).toContainText('864 × 397 × 18');
  });

  test('AC-025: with errors the outputs show the error list and "Fix in editor" focuses the field', async ({ page }) => {
    const id = await createFromTemplate(page, 'blank');
    await outlineNode(page, 'Carcass').click();
    await page.getByRole('combobox', { name: /^Back panel/ }).selectOption('mat-ply-9');
    await expect(page.getByRole('link', { name: /^Outputs/ })).toContainText('1 error');
    await page.goto(`/#/d/${id}/outputs/hardware`);
    const blocked = page.getByTestId('outputs-blocked');
    await expect(blocked).toContainText('9 mm thick');
    await expect(page.locator('table')).toHaveCount(0);

    await blocked.getByRole('button', { name: 'Fix in editor' }).click();
    await expect(page).toHaveURL(new RegExp(`#/d/${id}$`));
    await expect(page.getByRole('combobox', { name: /^Back panel/ })).toBeFocused();
    await page.getByRole('combobox', { name: /^Back panel/ }).selectOption('mat-ply-6');
    await page.goto(`/#/d/${id}/outputs/cut-list`);
    await expect(page.getByTestId('outputs-blocked')).toHaveCount(0);
    await expect(page.locator('table[data-material="mat-ply-6"]')).toBeVisible();
  });

  test('an invalid tab falls back to the cut list', async ({ page }) => {
    const id = await createFromTemplate(page, 'blank');
    await page.goto(`/#/d/${id}/outputs/nonsense`);
    await expect(page.getByRole('link', { name: 'Cut list' })).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('edge banding overrides (L-13)', () => {
  test('editing a position updates the cut list and reset restores the defaults', async ({ page }) => {
    const id = await createFromTemplate(page, 'bookcase');
    await outlineNode(page, 'Edge banding').click();

    const top = page.getByTestId('banding-position-3');
    await expect(top).toContainText('Top');
    await expect(top.getByRole('checkbox', { name: 'front edge' })).toBeChecked();
    await top.getByRole('checkbox', { name: 'left edge' }).check();
    await expect(page.getByTestId('save-status')).toHaveText('Saved');

    await page.getByRole('link', { name: /^Outputs/ }).click();
    await expect(page.locator('tr[data-position="3"]')).toContainText('L: 1 · W: 1');

    await page.goto(`/#/d/${id}`);
    await outlineNode(page, 'Edge banding').click();
    await expect(page.getByTestId('banding-position-3').getByRole('checkbox', { name: 'left edge' })).toBeChecked();
    await page.getByRole('button', { name: 'Reset all to defaults' }).click();
    await expect(page.getByTestId('banding-position-3').getByRole('checkbox', { name: 'left edge' })).not.toBeChecked();
    await expect(page.getByTestId('banding-position-3').getByRole('checkbox', { name: 'front edge' })).toBeChecked();
  });
});
