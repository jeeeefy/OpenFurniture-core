import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createDesign, deriveModel, generateOutputs } from '@/domain';
import { DrillingPlans } from '@/app/components/DrillingPlans';
import { I18nProvider } from '@/i18n/useT';
import { counterIds, NOW } from '../helpers';

function renderPlans(locale: 'en' | 'de' = 'en', mutate?: (doc: ReturnType<typeof createDesign>) => void) {
  const doc = createDesign('cabinet', counterIds(), NOW, 'Cabinet');
  mutate?.(doc);
  const result = deriveModel(doc);
  if (!result.ok) throw new Error('derive failed');
  const out = generateOutputs(doc, result.model);
  render(
    <I18nProvider locale={locale}>
      <DrillingPlans doc={doc} plans={out.drillingPlans} positions={out.positions} />
    </I18nProvider>,
  );
  return out;
}

describe('drilling plan view (T-021)', () => {
  it('the hole table lists every hole and mark of each face', () => {
    const out = renderPlans();
    for (const plan of out.drillingPlans) {
      const article = document.querySelector(`article[data-position="${String(plan.position)}"]`) as HTMLElement;
      for (const face of plan.faces) {
        const section = article.querySelector(`section[data-face="${face.face}"]`) as HTMLElement;
        expect(section.querySelectorAll('tbody tr')).toHaveLength(face.holes.length + face.marks.length);
        expect(section.querySelectorAll('svg [data-ref]')).toHaveLength(face.holes.length + face.marks.length);
      }
    }
  });

  it('shows the unverified-profile banner, edge labels, the origin and the legend', () => {
    renderPlans();
    const door = document.querySelector('article[data-position] h3')?.closest('article');
    expect(door).toBeTruthy();
    expect(screen.getAllByTestId('unverified-banner')[0]?.textContent).toContain(
      'Unverified hardware profile – check against the datasheet before drilling',
    );
    const sideL = screen.getByRole('heading', { name: /Side left/ }).closest('article') as HTMLElement;
    const svg = within(sideL).getAllByRole('img')[0]!;
    expect(svg.textContent).toContain('front edge');
    expect(svg.textContent).toContain('0,0');
    expect(screen.getByRole('heading', { name: 'Legend' })).toBeTruthy();
  });

  it('German view uses decimal commas and German labels', () => {
    renderPlans('de');
    const door = screen.getAllByRole('heading', { name: /Tür/ })[0]!.closest('article') as HTMLElement;
    expect(within(door).getAllByText('21,5').length).toBeGreaterThan(0);
    expect(within(door).getAllByText('Scharniertopf').length).toBe(2);
  });

  it('user text renders as text only', () => {
    renderPlans('en', (doc) => {
      doc.materials[0]!.name = '<img src=x onerror=alert(1)>';
    });
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getAllByText(/<img src=x onerror=alert\(1\)>/).length).toBeGreaterThan(0);
  });
});
