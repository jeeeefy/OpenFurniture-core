import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createDesign } from '@/domain';
import { App } from '@/app/App';
import { AppContext, type AppServices } from '@/app/context';
import { StartPage } from '@/app/routes/StartPage';
import { createEditorStore } from '@/app/store/editorStore';
import { I18nProvider } from '@/i18n/useT';
import { MemoryRepository } from '@/persistence/memoryRepository';
import { counterIds, NOW } from '../helpers';

describe('extension seam (T-103, AC-104)', () => {
  it('renders no account/pricing/legal links in the core build', () => {
    render(<App />);
    expect(screen.queryByRole('link', { name: 'Account / Pro' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Pricing' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Imprint' })).toBeNull();
  });

  it('StartPage uses routes from AppServices for the "Open" link', async () => {
    const repo = new MemoryRepository();
    const editor = createEditorStore();
    const doc = createDesign('blank', counterIds(), NOW, 'Shelf');
    await repo.create(doc);

    const routes = {
      start: () => '#/home',
      editor: (id: string) => `#/custom/${id}`,
      outputs: (id: string) => `#/custom/${id}/out`,
      print: (id: string) => `#/custom/${id}/print`,
    };
    const services: AppServices = {
      repo,
      editor,
      locale: 'en',
      setLocale: () => undefined,
      newId: counterIds('new'),
      nowIso: () => NOW,
      routes,
    };

    render(
      <I18nProvider locale="en">
        <AppContext.Provider value={services}>
          <StartPage />
        </AppContext.Provider>
      </I18nProvider>,
    );

    await screen.findByText('Shelf');
    const openLinks = await screen.findAllByRole('link', { name: 'Open' });
    expect(openLinks.length).toBeGreaterThan(0);
    expect(openLinks[0]!.getAttribute('href')).toBe(`#/custom/${doc.id}`);
  });
});
