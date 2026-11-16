import type { DesignDocument } from '@/domain';
import { useT } from '@/i18n/useT';
import { useEditor, useApp } from '../context';
import { BANDING_SELECTION, CARCASS_SELECTION, HARDWARE_SELECTION, MATERIALS_SELECTION, PLINTH_SELECTION, type Selection } from '../store/selectors';

function NodeButton({ selection, label }: { selection: Selection; label: string }) {
  const { editor } = useApp();
  const current = useEditor((s) => s.selection);
  const active = current?.kind === selection.kind && current.id === selection.id;
  return (
    <button
      type="button"
      className="outline-node"
      aria-current={active ? 'true' : undefined}
      data-node={`${selection.kind}:${selection.id}`}
      onClick={() => {
        editor.getState().select(selection);
      }}
    >
      {label}
    </button>
  );
}

/** Nested lists of buttons (plan §6.6); every node is also reachable without the 3D view. */
export function Outline({ doc }: { doc: DesignDocument }) {
  const { t } = useT();
  return (
    <ul className="outline-tree">
      <li>
        <NodeButton selection={CARCASS_SELECTION} label={t('outline.carcass')} />
        <ul>
          {doc.carcass.base.kind === 'plinth' && (
            <li>
              <NodeButton selection={PLINTH_SELECTION} label={t('outline.plinth')} />
            </li>
          )}
          {doc.layout.columns.map((column, ci) => (
            <li key={column.id}>
              <NodeButton selection={{ kind: 'column', id: column.id }} label={t('outline.column', { n: ci + 1 })} />
              <ul>
                {column.sections.map((section, si) => (
                  <li key={section.id}>
                    <NodeButton selection={{ kind: 'section', id: section.id }} label={t('outline.section', { n: si + 1 })} />
                    {section.front.kind === 'drawers' && (
                      <ul>
                        {section.front.drawers.map((drawer, di) => (
                          <li key={drawer.id}>
                            <NodeButton selection={{ kind: 'drawer', id: drawer.id }} label={t('outline.drawer', { n: di + 1 })} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </li>
      <li>
        <NodeButton selection={MATERIALS_SELECTION} label={t('outline.materials')} />
      </li>
      <li>
        <NodeButton selection={BANDING_SELECTION} label={t('outline.banding')} />
      </li>
      <li>
        <NodeButton selection={HARDWARE_SELECTION} label={t('outline.hardware')} />
      </li>
    </ul>
  );
}
