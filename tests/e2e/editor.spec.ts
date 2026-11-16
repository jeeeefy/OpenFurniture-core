import { expect, test } from './fixtures';
import { blockWebGL2, createFromTemplate, outlineNode } from './helpers';

test.describe('editor shell (T-007)', () => {
  test('AC-002: start page lists the available templates and a blank design opens the editor', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-template]')).toHaveCount(6);
    await createFromTemplate(page, 'blank');
    await expect(outlineNode(page, 'Carcass')).toBeVisible();
    await expect(outlineNode(page, 'Column 1')).toBeVisible();
    await expect(outlineNode(page, 'Section 1')).toBeVisible();
    await expect(page.getByTestId('viewport-canvas')).toHaveAttribute('data-part-count', '5');
  });

  test('AC-019: clicking a part in 3D selects its owner, and outline selection highlights parts', async ({ page }) => {
    await createFromTemplate(page, 'bookcase');
    const canvas = page.getByTestId('viewport-canvas');
    // 5 carcass parts incl. back, 1 divider, 4 fixed and 4 adjustable shelves.
    await expect(canvas).toHaveAttribute('data-part-count', '14');
    await page.getByRole('button', { name: 'Front', exact: true }).click();
    // In the front view the centre ray hits the divider's front edge (x 391–409 of 800).
    const box = await canvas.boundingBox();
    if (!box) throw new Error('canvas not laid out');
    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
    await expect(outlineNode(page, 'Column 1')).toHaveAttribute('aria-current', 'true');
    await expect(canvas).toHaveAttribute('data-selected-parts', /divider:/);

    await outlineNode(page, 'Carcass').click();
    await expect(outlineNode(page, 'Carcass')).toHaveAttribute('aria-current', 'true');
    await expect(canvas).toHaveAttribute('data-selected-parts', 'back bottom side:L side:R top');
  });

  test('AC-020: view presets, fit and toggles; the camera survives selection and toggles', async ({ page }) => {
    await createFromTemplate(page, 'bookcase');
    const canvas = page.getByTestId('viewport-canvas');
    await expect(canvas).toHaveAttribute('data-camera', /.+/);
    // The camera attribute is written on the next animation frame, so poll it.
    const camera = async () => ((await canvas.getAttribute('data-camera')) ?? '').split(',').map(Number);

    await page.getByRole('button', { name: 'Front', exact: true }).click();
    await expect.poll(async () => (await camera())[0]).toBe(400);
    await expect.poll(async () => (await camera())[2]).toBeGreaterThan(300);

    await page.getByRole('button', { name: 'Side', exact: true }).click();
    await expect.poll(async () => (await camera())[0]).toBeGreaterThan(800);
    await page.getByRole('button', { name: 'Top', exact: true }).click();
    await expect.poll(async () => (await camera())[1]).toBeGreaterThan(2000);
    const top = (await camera()).join(',');
    await page.getByRole('button', { name: 'Fit', exact: true }).click();
    await expect(canvas).toHaveAttribute('data-camera', top);

    await page.getByRole('checkbox', { name: 'Back panel' }).uncheck();
    await expect(canvas).toHaveAttribute('data-hidden-parts', '1');
    await page.getByRole('checkbox', { name: 'Back panel' }).check();
    await expect(canvas).toHaveAttribute('data-hidden-parts', '0');
    await outlineNode(page, 'Section 1').first().click();
    await expect(canvas).toHaveAttribute('data-camera', top);
  });

  test('AC-021: without WebGL2 the editor explains it and stays usable via the outline', async ({ page }) => {
    await blockWebGL2(page);
    await createFromTemplate(page, 'bookcase');
    await expect(page.getByTestId('viewport-fallback')).toContainText('WebGL2');
    await outlineNode(page, 'Column 2').click();
    await expect(outlineNode(page, 'Column 2')).toHaveAttribute('aria-current', 'true');
    await outlineNode(page, 'Carcass').click();
    await expect(outlineNode(page, 'Carcass')).toHaveAttribute('aria-current', 'true');
  });

  test('unknown design ids and routes show not-found pages', async ({ page }) => {
    await page.goto('/#/d/does-not-exist');
    await expect(page.getByRole('heading', { name: 'Design not found' })).toBeVisible();
    await page.goto('/#/nowhere');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await page.goto('/this-path-does-not-exist');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await page.getByRole('link', { name: 'Go to the start page' }).click();
    await expect(page.getByRole('heading', { name: 'Start a new design' })).toBeVisible();
  });
});
