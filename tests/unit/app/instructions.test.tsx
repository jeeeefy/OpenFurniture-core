import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { createDesign, deriveModel, generateOutputs, type AssemblyStep } from '@/domain';
import { Instructions } from '@/app/components/Instructions';
import { I18nProvider } from '@/i18n/useT';
import { counterIds, NOW } from '../helpers';

const renderStepImages = vi.fn<(model: unknown, steps: readonly AssemblyStep[]) => Promise<Map<number, string>>>();
vi.mock('@/render3d/stepImages', () => ({ renderStepImages: (m: unknown, s: readonly AssemblyStep[]) => renderStepImages(m, s) }));

function setup(locale: 'en' | 'de' = 'en') {
  const doc = createDesign('sideboard', counterIds(), NOW, 'Sideboard');
  const result = deriveModel(doc);
  if (!result.ok) throw new Error('derive failed');
  const outputs = generateOutputs(doc, result.model);
  render(
    <I18nProvider locale={locale}>
      <Instructions model={result.model} outputs={outputs} />
    </I18nProvider>,
  );
  return outputs;
}

describe('instructions view (T-023)', () => {
  beforeEach(() => {
    renderStepImages.mockReset();
  });

  it('AC-034: every step shows its image, text, new parts, hardware, tools and orientation', async () => {
    renderStepImages.mockImplementation((_m, steps) =>
      Promise.resolve(new Map(steps.map((s) => [s.index, `data:image/png;base64,${String(s.index)}`]))),
    );
    const outputs = setup();
    await waitFor(() => expect(screen.getAllByTestId('step-image')).toHaveLength(outputs.steps.length));
    for (const step of outputs.steps) {
      const article = document.querySelector(`article[data-step="${String(step.index)}"]`) as HTMLElement;
      expect(within(article).getByTestId('step-image').getAttribute('src')).toBe(`data:image/png;base64,${String(step.index)}`);
      expect(within(article).getByText('Orientation')).toBeTruthy();
      if (step.hardware.length > 0) expect(within(article).getByTestId('step-hardware').children).toHaveLength(step.hardware.length);
      if (step.tools.length > 0) expect(within(article).getByTestId('step-tools').textContent).not.toBe('—');
    }
    const drawers = document.querySelector('article[data-phase="P10"]') as HTMLElement;
    expect(within(drawers).getByTestId('step-new-parts').textContent).toMatch(/Pos\. \d+ Drawer front/);
    expect(within(screen.getByTestId('tools-list')).getByText('Forstner bit Ø35 mm')).toBeTruthy();
  });

  it('AC-021: without WebGL every step shows an explicit placeholder, never a blank image', async () => {
    renderStepImages.mockResolvedValue(new Map());
    const outputs = setup('de');
    await waitFor(() => expect(screen.getAllByTestId('step-placeholder')[0]?.textContent).toContain('Abbildung nicht verfügbar'));
    expect(screen.getAllByTestId('step-placeholder')).toHaveLength(outputs.steps.length);
    expect(screen.queryAllByTestId('step-image')).toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'Schubkästen' })).toBeTruthy();
  });

  it('a failing renderer also falls back to placeholders', async () => {
    renderStepImages.mockRejectedValue(new Error('context lost'));
    const outputs = setup();
    await waitFor(() => expect(screen.getAllByTestId('step-placeholder')[0]?.textContent).toContain('Illustration not available'));
    expect(screen.getAllByTestId('step-placeholder')).toHaveLength(outputs.steps.length);
  });
});
