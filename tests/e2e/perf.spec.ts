import { expect, test } from './fixtures';
import { createFromTemplate, outlineNode } from './helpers';

test.describe('performance (T-027, AC-050)', () => {
  test('commit → 3D view updated in < 200 ms (largest template)', async ({ page }) => {
    await createFromTemplate(page, 'sideboard');
    const canvas = page.getByTestId('viewport-canvas');
    await expect(canvas).toHaveAttribute('data-rendered-model', /\d+/);
    await outlineNode(page, 'Carcass').click();
    const width = page.getByRole('textbox', { name: /^Width/ });

    const samples: number[] = [];
    for (const value of ['1500', '1550', '1600', '1650', '1700', '1600']) {
      await width.fill(value);
      const elapsed = await page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            const target = document.querySelector<HTMLCanvasElement>('[data-testid="viewport-canvas"]')!;
            const field = document.activeElement as HTMLInputElement;
            const before = target.dataset.renderedModel;
            const observer = new MutationObserver(() => {
              if (target.dataset.renderedModel !== before) {
                observer.disconnect();
                resolve(performance.now() - start);
              }
            });
            observer.observe(target, { attributes: true, attributeFilter: ['data-rendered-model'] });
            const start = performance.now();
            field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          }),
      );
      samples.push(elapsed);
      await expect(canvas).toHaveAttribute('aria-label', new RegExp(`${value} ×`));
    }
    console.log(`AC-050 commit → 3D (ms): ${samples.map((s) => s.toFixed(1)).join(', ')}`);
    expect(Math.max(...samples)).toBeLessThan(200);
  });
});
