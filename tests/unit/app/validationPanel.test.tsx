import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createDesign, ERROR_CODES, WARNING_CODES, setCarcassDimension, setMaterialAssignment } from '@/domain';
import { AppContext, type AppServices } from '@/app/context';
import { coreRoutes } from '@/app/router';
import { useEditor } from '@/app/context';
import { Inspector } from '@/app/components/inspector/Inspector';
import { ValidationPanel } from '@/app/components/ValidationPanel';
import { createEditorStore } from '@/app/store/editorStore';
import { dictionaries } from '@/i18n';
import { I18nProvider } from '@/i18n/useT';
import { MemoryRepository } from '@/persistence/memoryRepository';
import { counterIds, NOW } from '../helpers';

function Editor() {
  const doc = useEditor((s) => s.doc);
  return doc ? (
    <>
      <Inspector doc={doc} />
      <ValidationPanel doc={doc} />
    </>
  ) : null;
}

function setup() {
  const editor = createEditorStore();
  editor.getState().load(createDesign('blank', counterIds(), NOW, 'Shelf'), 1);
  const services: AppServices = {
    repo: new MemoryRepository(),
    editor,
    locale: 'en',
    setLocale: () => undefined,
    newId: counterIds('new'),
    nowIso: () => NOW,
    routes: coreRoutes(),
  };
  render(
    <I18nProvider locale="en">
      <AppContext.Provider value={services}>
        <Editor />
      </AppContext.Provider>
    </I18nProvider>,
  );
  return editor;
}

describe('validation panel (AC-024, T-013)', () => {
  it('every issue code has an EN and a DE text', () => {
    for (const code of [...ERROR_CODES, ...WARNING_CODES]) {
      expect(dictionaries.en[`issue.${code}`], code).toBeDefined();
      expect(dictionaries.de[`issue.${code}`], code).toBeDefined();
    }
  });

  it('shows counts and lists issues with severity, target and text', () => {
    const editor = setup();
    expect(screen.getByTestId('validation-counts').textContent).toBe('0 errors · 0 warnings');
    act(() => {
      editor.getState().commit(setCarcassDimension, { field: 'heightMm', value: 800 });
      editor.getState().commit(setMaterialAssignment, { group: 'back', materialId: 'mat-ply-9' });
    });
    expect(screen.getByTestId('validation-counts').textContent).toBe('1 error · 1 warning');
    const error = screen.getByRole('button', { name: /BACK|back panel material/i });
    expect(error.getAttribute('data-code')).toBe('BACK_THICKNESS_OUT_OF_RANGE');
    expect(error.textContent).toContain('Error');
    expect(error.textContent).toContain('Material Birch plywood 9 mm');
    expect(error.textContent).toContain('9 mm thick; it must be 3–8 mm');
  });

  it('activating an issue selects its target and focuses the related field', () => {
    const editor = setup();
    act(() => {
      editor.getState().commit(setCarcassDimension, { field: 'heightMm', value: 800 });
      editor.getState().commit(setMaterialAssignment, { group: 'back', materialId: 'mat-ply-9' });
    });
    fireEvent.click(screen.getByRole('button', { name: /At 800 mm this piece can tip over/ }));
    expect(editor.getState().selection).toEqual({ kind: 'carcass', id: 'carcass' });
    expect(document.activeElement?.id).toBe('field-carcass-heightMm');

    fireEvent.click(screen.getByRole('button', { name: /back panel material/i }));
    expect(document.activeElement?.id).toBe('field-carcass-material-back');
  });
});
