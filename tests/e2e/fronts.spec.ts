import { expect, test } from './fixtures';
import { createFromTemplate, outlineNode } from './helpers';

test.describe('fronts, materials and hardware editors (T-020)', () => {
  test('switching a section with shelves to drawers asks first; Cancel changes nothing', async ({ page }) => {
    await createFromTemplate(page, 'bookcase');
    await outlineNode(page, 'Column 2').click();
    await outlineNode(page, 'Section 1').last().click();
    // The radio only changes after confirmation, so click instead of check.
    await page.getByRole('radio', { name: 'Drawers', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Switch to drawers?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('radio', { name: 'Adjustable shelves' })).toBeChecked();
    await expect(outlineNode(page, 'Drawer 1')).toHaveCount(0);

    await page.getByRole('radio', { name: 'Drawers', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Switch to drawers' }).click();
    await expect(page.getByRole('radio', { name: 'Empty' })).toBeChecked();
    await expect(outlineNode(page, 'Drawer 3')).toBeVisible();
    await page.getByRole('combobox', { name: 'Number of drawers' }).selectOption('4');
    await expect(outlineNode(page, 'Drawer 4')).toBeVisible();

    await outlineNode(page, 'Drawer 1').click();
    await page.getByRole('radio', { name: 'Fixed' }).check();
    await page.getByRole('textbox', { name: /^Front height/ }).fill('300');
    await page.getByRole('textbox', { name: /^Front height/ }).press('Enter');
    await expect(page.getByRole('textbox', { name: /^Front height/ })).toHaveValue('300');
  });

  test('doors: single door with hinge side and handle; outputs list hinges', async ({ page }) => {
    const id = await createFromTemplate(page, 'blank');
    await outlineNode(page, 'Section 1').click();
    await page.getByRole('radio', { name: 'Single door' }).check();
    await page.getByRole('radio', { name: 'Right' }).check();
    await page.getByRole('combobox', { name: 'Handle' }).selectOption('h-knob');
    await page.goto(`/#/d/${id}/outputs/hardware`);
    await expect(page.locator('tr[data-key="hinge:full"]')).toContainText('2');
    await expect(page.locator('tr[data-key="handle:h-knob"]')).toContainText('Unverified profile');
  });

  test('AC-022: material and profile edits stay in the current design', async ({ page }) => {
    const first = await createFromTemplate(page, 'cabinet');
    await outlineNode(page, 'Materials').click();
    await page.getByText('Birch plywood 18 mm (18 mm)').click();
    const thickness = page.locator('#field-material-mat-ply-18-thicknessMm');
    await thickness.fill('19');
    await thickness.press('Enter');
    await outlineNode(page, 'Hardware profiles').click();
    await page.getByText('Concealed hinge').click();
    await page.getByRole('textbox', { name: /^Cup diameter/ }).fill('40');
    await page.getByRole('textbox', { name: /^Cup diameter/ }).press('Enter');
    await expect(page.getByTestId('save-status')).toHaveText('Saved');

    const second = await createFromTemplate(page, 'cabinet');
    expect(second).not.toBe(first);
    await outlineNode(page, 'Materials').click();
    await page.getByText('Birch plywood 18 mm (18 mm)').click();
    await expect(page.locator('#field-material-mat-ply-18-thicknessMm')).toHaveValue('18');
    await outlineNode(page, 'Hardware profiles').click();
    await page.getByText('Concealed hinge').click();
    await expect(page.getByRole('textbox', { name: /^Cup diameter/ })).toHaveValue('35');

    await page.goto(`/#/d/${first}`);
    await outlineNode(page, 'Materials').click();
    await page.getByText('Birch plywood 18 mm (19 mm)').click();
    await expect(page.locator('#field-material-mat-ply-18-thicknessMm')).toHaveValue('19');
  });

  test('AC-023: marking the hinge as verified removes its warning; the panel link opens the profile', async ({ page }) => {
    await createFromTemplate(page, 'cabinet');
    const counts = page.getByTestId('validation-counts');
    await expect(counts).toContainText('3 warnings');
    await page.locator('[data-code="HARDWARE_PROFILE_UNVERIFIED"]').filter({ hasText: 'cup hinge' }).click();
    const verified = page.locator('#field-profile-hinge-generic-35-verified');
    await expect(verified).toBeFocused();
    await verified.check();
    await expect(counts).toContainText('2 warnings');
    await expect(page.locator('[data-code="HARDWARE_PROFILE_UNVERIFIED"]').filter({ hasText: 'cup hinge' })).toHaveCount(0);
  });

  test('materials can be added and removed unless they are in use', async ({ page }) => {
    await createFromTemplate(page, 'blank');
    await outlineNode(page, 'Materials').click();
    const cards = page.locator('details.editor-card:not(#field-cutting)');
    await expect(cards).toHaveCount(7);
    await page.getByRole('button', { name: 'Add material' }).click();
    await expect(cards).toHaveCount(8);
    const inUse = cards.first();
    await inUse.locator('summary').click();
    await expect(inUse.getByRole('button', { name: 'Remove material' })).toBeDisabled();
    const added = cards.last();
    await added.locator('summary').click();
    await added.getByRole('button', { name: 'Remove material' }).click();
    await expect(cards).toHaveCount(7);
  });
});
