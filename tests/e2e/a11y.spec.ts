import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';
import { createFromTemplate } from './helpers';

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, impact: v.impact, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
}

test.describe('accessibility (T-027, AC-051)', () => {
  test('start, editor, outputs, print, settings and imprint have no serious or critical axe findings', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const found: Record<string, unknown> = {};
    const check = async (name: string) => {
      const v = await seriousViolations(page);
      if (v.length > 0) found[name] = v;
    };
    await check('start (empty)');

    const id = await createFromTemplate(page, 'sideboard');
    await check('editor');
    await page.goto('/');
    await check('start (list)');
    for (const tab of ['cut-list', 'cutting', 'hardware', 'drilling', 'instructions']) {
      await page.goto(`/#/d/${id}/outputs/${tab}`);
      if (tab === 'instructions') await expect(page.locator('.instructions')).toHaveAttribute('data-images', 'done', { timeout: 30_000 });
      await check(`outputs/${tab}`);
    }
    await page.goto(`/#/d/${id}/print`);
    await expect(page.locator('.print-document')).toHaveAttribute('data-images', 'done', { timeout: 30_000 });
    await check('print');
    await page.goto('/#/settings');
    await check('settings');
    await page.goto('/#/imprint');
    await check('imprint');
    expect(found).toEqual({});
  });
});
