import { expect, test } from './fixtures';
import { createFromTemplate, outlineNode } from './helpers';

test.describe('inner drawers and clothes rails', () => {
  test('inner drawers behind the cabinet doors: 3D, hint, hardware and steps', async ({ page }) => {
    const id = await createFromTemplate(page, 'cabinet');
    const canvas = page.getByTestId('viewport-canvas');
    const before = Number(await canvas.getAttribute('data-part-count'));
    await outlineNode(page, 'Section 1').click();
    await page.getByRole('radio', { name: 'Inner drawers' }).check();
    await expect(page.getByText(/start 70 mm behind the front edge/)).toBeVisible();
    await page.getByRole('combobox', { name: 'Number of inner drawers' }).selectOption('3');
    // Two adjustable shelves go, three boxes of five parts come.
    await expect(canvas).toHaveAttribute('data-part-count', String(before - 2 + 15));
    await expect(page.getByTestId('validation-counts')).toContainText('0 errors');

    await page.goto(`/#/d/${id}/outputs/hardware`);
    await expect(page.locator('tr[data-key^="slide:"]')).toContainText('3');
    await page.getByRole('link', { name: 'Instructions' }).click();
    await expect(page.locator('article[data-phase="P10"]')).toContainText('Build the 3 drawers');
  });

  test('a door stays over a fixed shelf inserted behind it and can cover several sections', async ({ page }) => {
    await createFromTemplate(page, 'blank');
    const canvas = page.getByTestId('viewport-canvas');
    await outlineNode(page, 'Section 1').click();
    await page.getByRole('radio', { name: 'Single door' }).check();
    const withDoor = Number(await canvas.getAttribute('data-part-count'));
    await page.getByRole('button', { name: /^Split section/ }).click();
    // One fixed shelf more, still one door.
    await expect(canvas).toHaveAttribute('data-part-count', String(withDoor + 1));
    await expect(page.getByRole('combobox', { name: /^Door covers sections/ })).toHaveValue('2');
    await expect(page.getByTestId('validation-counts')).toContainText('0 errors');

    await outlineNode(page, 'Section 2').click();
    await expect(page.getByTestId('front-covered')).toContainText('behind the door of section 1');

    await outlineNode(page, 'Section 1').click();
    await page.getByRole('combobox', { name: /^Door covers sections/ }).selectOption('1');
    await outlineNode(page, 'Section 2').click();
    await expect(page.getByTestId('front-covered')).toHaveCount(0);
    await expect(page.getByRole('radio', { name: 'No front' })).toBeChecked();
  });

  test('a clothes rail is drawn in 3D as soon as it is chosen', async ({ page }) => {
    await createFromTemplate(page, 'wardrobe');
    const canvas = page.getByTestId('viewport-canvas');
    await expect(canvas).toHaveAttribute('data-rail-count', '1');

    await createFromTemplate(page, 'bookcase');
    await expect(canvas).toHaveAttribute('data-rail-count', '0');
    await outlineNode(page, 'Column 2').click();
    await outlineNode(page, 'Section 1').last().click();
    await page.getByRole('radio', { name: 'Clothes rail' }).check();
    await expect(canvas).toHaveAttribute('data-rail-count', '1');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(canvas).toHaveAttribute('data-rail-count', '0');
  });

  test('L-17: adjustable shelf heights can be set individually and reset to even spacing', async ({ page }) => {
    const id = await createFromTemplate(page, 'blank');
    await outlineNode(page, 'Section 1').click();
    await page.getByRole('radio', { name: 'Adjustable shelves' }).check();
    await page.getByRole('combobox', { name: 'Number of adjustable shelves' }).selectOption('2');

    const second = page.getByRole('textbox', { name: /^Shelf 2 position/ });
    const evenValue = await second.inputValue();
    await second.fill('550');
    await second.press('Enter');
    await expect(second).not.toHaveValue(evenValue);
    await expect(page.getByRole('button', { name: 'Even spacing' })).toBeVisible();
    await expect(page.getByTestId('save-status')).toHaveText(/Saved/);

    await page.goto(`/#/d/${id}`);
    await outlineNode(page, 'Section 1').click();
    await expect(page.getByRole('textbox', { name: /^Shelf 2 position/ })).not.toHaveValue(evenValue);
    await page.getByRole('button', { name: 'Even spacing' }).click();
    await expect(page.getByRole('button', { name: 'Even spacing' })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: /^Shelf 2 position/ })).toHaveValue(evenValue);
    await expect(page.getByTestId('validation-counts')).toContainText('0 errors');
  });
});
