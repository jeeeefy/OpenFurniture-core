import { expect, test } from './fixtures';
import { createFromTemplate } from './helpers';

test.describe('cutting layout', () => {
  test('boards per material, change the board size in the editor, fewer boards afterwards', async ({ page }) => {
    const id = await createFromTemplate(page, 'bookcase');
    await page.goto(`/#/d/${id}/outputs/cutting`);
    const ply = page.locator('section.cutting-material[data-material="mat-ply-18"]');
    await expect(ply.getByTestId('cutting-summary')).toContainText('2 boards of 2500 × 1250 mm');
    await expect(ply.locator('svg.cutting-svg')).toHaveCount(2);
    await expect(page.getByTestId('cutting-settings')).toContainText('Saw kerf 3 mm, edge trim 5 mm');

    await page.getByRole('link', { name: 'Cut list' }).click();
    await expect(page.locator('[data-testid="material-areas"] tr[data-material="mat-ply-18"] [data-testid="boards-needed"]')).toHaveText('2 boards of 2500 × 1250 mm');

    await page.getByRole('link', { name: 'Cutting layout' }).click();
    await ply.getByRole('button', { name: 'Change board size' }).click();
    await expect(page).toHaveURL(new RegExp(`#/d/${id}$`));
    const length = page.locator('#field-material-mat-ply-18-sheetLength');
    await expect(length).toBeFocused();
    await length.fill('3050');
    await length.press('Enter');
    const width = page.locator('#field-material-mat-ply-18-sheetWidth');
    await width.fill('1525');
    await width.press('Enter');
    await expect(page.getByTestId('save-status')).toHaveText('Saved');

    await page.goto(`/#/d/${id}/outputs/cutting`);
    await expect(ply.getByTestId('cutting-summary')).toContainText('1 board of 3050 × 1525 mm');
    await expect(ply.locator('svg.cutting-svg')).toHaveCount(1);
  });

  test('a further board size is used where it saves area', async ({ page }) => {
    const id = await createFromTemplate(page, 'bookcase');
    await page.goto(`/#/d/${id}/outputs/cutting`);
    const ply = page.locator('section.cutting-material[data-material="mat-ply-18"]');
    await ply.getByRole('button', { name: 'Change board size' }).click();
    const card = page.locator('details.editor-card', { has: page.locator('#field-material-mat-ply-18-sheetLength') });
    await card.getByRole('button', { name: 'Add board size' }).click();
    await expect(card.getByTestId('extra-sheet')).toHaveCount(1);
    const width = page.locator('#field-material-mat-ply-18-extraSheet-0-width');
    await width.fill('625');
    await width.press('Enter');
    await expect(page.getByTestId('save-status')).toHaveText('Saved');

    await page.goto(`/#/d/${id}/outputs/cutting`);
    await expect(ply.getByTestId('cutting-summary')).toContainText('1 board of 2500 × 1250 mm + 1 board of 2500 × 625 mm');
    await expect(ply.locator('figcaption').last()).toContainText('(2500 × 625 mm)');

    await page.getByRole('link', { name: 'Cut list' }).click();
    await expect(page.locator('[data-testid="material-areas"] tr[data-material="mat-ply-18"]')).toContainText('2500 × 625 mm');
  });

  test('saw kerf and trim are adjustable in the editor', async ({ page }) => {
    const id = await createFromTemplate(page, 'blank');
    await page.goto(`/#/d/${id}/outputs/cutting`);
    await page.getByRole('button', { name: 'Change saw kerf and trim' }).click();
    const kerf = page.locator('#field-cutting-kerf');
    await expect(kerf).toBeFocused();
    await kerf.fill('4');
    await kerf.press('Enter');
    await page.locator('#field-cutting-trim').fill('10');
    await page.locator('#field-cutting-trim').press('Enter');
    await expect(page.getByTestId('save-status')).toHaveText('Saved');
    await page.goto(`/#/d/${id}/outputs/cutting`);
    await expect(page.getByTestId('cutting-settings')).toContainText('Saw kerf 4 mm, edge trim 10 mm');
  });
});
