import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDesign, type Locale } from '@/domain';
import { AppContext, type AppServices } from '@/app/context';
import { coreRoutes } from '@/app/router';
import { CarcassInspector } from '@/app/components/inspector/CarcassInspector';
import { createEditorStore } from '@/app/store/editorStore';
import { useEditor } from '@/app/context';
import { I18nProvider } from '@/i18n/useT';
import { MemoryRepository } from '@/persistence/memoryRepository';
import { counterIds, NOW } from '../helpers';

function Connected() {
  const doc = useEditor((s) => s.doc);
  return doc ? <CarcassInspector doc={doc} /> : null;
}

function setup(locale: Locale = 'en') {
  const editor = createEditorStore();
  const doc = createDesign('blank', counterIds(), NOW, 'Shelf');
  editor.getState().load(doc, 1);
  const services: AppServices = {
    repo: new MemoryRepository(),
    editor,
    locale,
    setLocale: () => undefined,
    newId: counterIds('new'),
    nowIso: () => NOW,
    routes: coreRoutes(),
  };
  render(
    <I18nProvider locale={locale}>
      <AppContext.Provider value={services}>
        <Connected />
      </AppContext.Provider>
    </I18nProvider>,
  );
  return { editor, doc, user: userEvent.setup() };
}

describe('NumberField and carcass inspector (T-012)', () => {
  it('labels show "(mm)" and the range', () => {
    setup();
    expect(screen.getByRole('textbox', { name: 'Width (mm, 200–2400)' })).toHaveProperty('value', '600');
  });

  it.each(['150', '2500', '', 'abc', '12,34', '1.000'])('AC-004: rejects %j at the field without changing the design', async (text) => {
    const { editor, doc, user } = setup();
    const input = screen.getByRole('textbox', { name: /^Width/ });
    await user.clear(input);
    if (text) await user.type(input, text);
    await user.keyboard('{Enter}');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const message = document.getElementById(input.getAttribute('aria-describedby') ?? '');
    expect(message?.textContent).toBeTruthy();
    expect(input).toHaveProperty('value', text);
    expect(editor.getState().doc).toBe(doc);
    expect(editor.getState().history.past).toHaveLength(0);
  });

  it('commits on Enter and on blur, one history entry each; Escape reverts', async () => {
    const { editor, user } = setup();
    const width = screen.getByRole('textbox', { name: /^Width/ });
    await user.clear(width);
    await user.type(width, '800{Enter}');
    expect(editor.getState().doc?.carcass.widthMm).toBe(800);
    expect(editor.getState().history.past).toHaveLength(1);

    const height = screen.getByRole('textbox', { name: /^Height/ });
    await user.clear(height);
    await user.type(height, '900');
    await user.tab();
    expect(editor.getState().doc?.carcass.heightMm).toBe(900);
    expect(editor.getState().history.past).toHaveLength(2);

    await user.clear(height);
    await user.type(height, '1000{Escape}');
    expect(height).toHaveProperty('value', '900');
    await user.tab();
    expect(editor.getState().history.past).toHaveLength(2);

    await user.click(width);
    await user.keyboard('{Enter}');
    expect(editor.getState().history.past).toHaveLength(2);
  });

  it('German UI accepts "12,5" and shows a decimal comma', async () => {
    const { editor, user } = setup('de');
    await user.click(screen.getByRole('radio', { name: 'Sockel' }));
    const setback = screen.getByRole('textbox', { name: /^Sockelrücksprung vorne/ });
    await user.clear(setback);
    await user.type(setback, '12,5{Enter}');
    const base = editor.getState().doc?.carcass.base;
    expect(base?.kind === 'plinth' && base.setbackFrontMm).toBe(12.5);
    expect(setback).toHaveProperty('value', '12,5');
  });

  it('base, back fastener and material selects commit operations', async () => {
    const { editor, user } = setup();
    await user.click(screen.getByRole('radio', { name: 'Plinth' }));
    expect(editor.getState().doc?.carcass.base).toMatchObject({ kind: 'plinth', heightMm: 100 });
    await user.click(screen.getByRole('radio', { name: 'Screws' }));
    expect(editor.getState().doc?.carcass.back.fastener).toBe('screw');
    await user.selectOptions(screen.getByRole('combobox', { name: /^Carcass/ }), 'mat-mel-19');
    expect(editor.getState().doc?.carcass.materialIds.carcass).toBe('mat-mel-19');
    expect(editor.getState().history.past).toHaveLength(3);
  });
});
