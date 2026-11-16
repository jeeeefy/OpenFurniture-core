import { expect, test } from './fixtures';
import { createFromTemplate, outlineNode } from './helpers';

// A4 printable width at 96 dpi: 210 mm − 2 × 12 mm margin.
const A4_CONTENT_PX = Math.floor(((210 - 24) / 25.4) * 96);

test.describe('print view (T-024)', () => {
  test('AC-036 layout / AC-037: sideboard document with all sections, safety notes and warnings', async ({ page }) => {
    const id = await createFromTemplate(page, 'sideboard');
    await page.goto(`/#/d/${id}/outputs/cut-list`);
    await page.getByRole('link', { name: 'Print / Save as PDF' }).click();
    await expect(page).toHaveURL(new RegExp(`#/d/${id}/print$`));

    const print = page.getByRole('button', { name: 'Print / Save as PDF' });
    await expect(page.locator('.print-document')).toHaveAttribute('data-images', 'done', { timeout: 30_000 });
    await expect(print).toBeEnabled();

    for (const heading of ['Safety and notes', 'Area per material (for estimating the price)', 'Cut list', 'Hardware and consumables', 'Tools', 'Drilling plans', 'Instructions']) {
      await expect(page.getByRole('heading', { name: heading, exact: true, level: 2 })).toBeVisible();
    }
    await expect(page.locator('.print-title')).toHaveText('Sideboard');
    const notes = page.getByTestId('safety-notes');
    await expect(notes.locator('li')).toHaveCount(5);
    await expect(notes).toContainText('planning aid, not an engineering or safety approval');
    await expect(notes).toContainText('Anchor tall or narrow furniture');
    await expect(notes).toContainText('rules of thumb');
    await expect(notes).toContainText('datasheet');
    await expect(page.getByTestId('outputs-warnings').locator('li[data-code="HARDWARE_PROFILE_UNVERIFIED"]').first()).toBeVisible();
    await expect(page.locator('.print-footer').first()).toContainText('Sideboard');

    const steps = await page.locator('article.assembly-step').count();
    expect(steps).toBeGreaterThan(8);
    const illustrated = await page.locator('article.assembly-step').evaluateAll(
      (articles) => articles.filter((a) => a.querySelector('img[src^="data:image/png"], [data-testid="step-placeholder"]')).length,
    );
    expect(illustrated).toBe(steps);

    await page.setViewportSize({ width: A4_CONTENT_PX, height: 1100 });
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.app-header')).toBeHidden();
    await expect(page.locator('.print-toolbar')).toBeHidden();
    const overflow = await page.evaluate((width) => {
      const wide = [...document.querySelectorAll<HTMLElement>('.print-document *')].filter(
        (el) => el.getBoundingClientRect().right > width + 1,
      );
      return { scroll: document.documentElement.scrollWidth - width, wide: wide.slice(0, 5).map((el) => el.className || el.tagName) };
    }, A4_CONTENT_PX);
    expect(overflow.wide).toEqual([]);
    expect(overflow.scroll).toBeLessThanOrEqual(0);
  });

  test('AC-036 (T-025): Chromium produces a non-empty A4 PDF of the sideboard', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'page.pdf is Chromium-only');
    const id = await createFromTemplate(page, 'sideboard');
    await page.goto(`/#/d/${id}/print`);
    await expect(page.locator('.print-document')).toHaveAttribute('data-images', 'done', { timeout: 30_000 });
    const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true });
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(100_000);
    const pages = pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(pages.length).toBeGreaterThan(10);
  });

  test('AC-025 print part: with errors the print view and the print button are blocked', async ({ page }) => {
    const id = await createFromTemplate(page, 'blank');
    await outlineNode(page, 'Carcass').click();
    await page.getByRole('combobox', { name: /^Back panel/ }).selectOption('mat-ply-9');
    await page.goto(`/#/d/${id}/outputs/cut-list`);
    await expect(page.getByRole('button', { name: 'Print / Save as PDF' })).toBeDisabled();
    await page.goto(`/#/d/${id}/print`);
    await expect(page.getByTestId('outputs-blocked')).toContainText('9 mm thick');
    await expect(page.getByRole('button', { name: 'Print / Save as PDF' })).toBeDisabled();
    await expect(page.locator('.print-document')).toHaveCount(0);
  });
});
