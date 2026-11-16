import { useEffect, useMemo, useRef, useState } from 'react';
import { positionByPartId } from '@/domain';
import { useT } from '@/i18n/useT';
import { createViewport, type Viewport as ViewportApi, type ViewPreset } from '@/render3d/viewport';
import { isWebGL2Available } from '@/render3d/webgl';
import { useApp, useEditor } from '../context';
import { ownerSelection, partsOfSelection, selectDerived, selectOutputs } from '../store/selectors';

const PRESETS: ViewPreset[] = ['iso', 'front', 'side', 'top'];

export function Viewport() {
  const { t } = useT();
  const { editor } = useApp();
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const viewOptions = useEditor((s) => s.viewOptions);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<ViewportApi | null>(null);
  const [webgl] = useState(isWebGL2Available);
  const [contextLost, setContextLost] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [apiVersion, setApiVersion] = useState(0);
  const hasDoc = doc !== null;

  const derived = doc ? selectDerived(doc) : null;
  const positions = useMemo(() => {
    const outputs = doc ? selectOutputs(doc) : null;
    return outputs ? positionByPartId(outputs.positions) : new Map<string, number>();
  }, [doc]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!webgl || !canvas || !hasDoc) return;
    let api: ViewportApi;
    try {
      api = createViewport(canvas, {
        onPick: (partId) => {
          const { doc: current } = editor.getState();
          const result = current ? selectDerived(current) : null;
          const part = result?.ok ? result.model.parts.find((p) => p.id === partId) : undefined;
          editor.getState().select(current && part ? ownerSelection(current, part) : null);
        },
        onHover: (partId) => {
          setHover(partId);
          editor.getState().setHover(partId);
        },
        onContextLost: () => {
          setContextLost(true);
        },
      });
    } catch {
      // The renderer can still fail after the WebGL2 probe (e.g. blocked GPU); show the fallback panel.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContextLost(true);
      return;
    }
    apiRef.current = api;
    setApiVersion((v) => v + 1);
    return () => {
      api.dispose();
      apiRef.current = null;
    };
  }, [webgl, editor, hasDoc]);

  useEffect(() => {
    if (!derived) return;
    apiRef.current?.setModel(derived.ok ? derived.model : null, derived.ok ? derived.model.envelope : derived.envelope);
  }, [derived, apiVersion]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    api.setSelection(doc && derived?.ok && selection ? partsOfSelection(doc, derived.model, selection) : []);
  }, [doc, derived, selection, apiVersion]);

  useEffect(() => {
    apiRef.current?.setOptions(viewOptions);
  }, [viewOptions, apiVersion]);

  if (!doc) return null;

  if (!webgl || contextLost) {
    return (
      <div className="viewport viewport-fallback" data-testid="viewport-fallback">
        <p>{t(contextLost ? 'view.contextLost' : 'view.noWebgl')}</p>
      </div>
    );
  }

  const hoveredPart = hover && derived?.ok ? derived.model.parts.find((p) => p.id === hover) : undefined;
  const { widthMm, heightMm, depthMm } = doc.carcass;

  return (
    <div className="viewport">
      <div className="viewport-toolbar" role="toolbar" aria-label={t('view.toolbar')}>
        {PRESETS.map((preset) => (
          <button key={preset} type="button" onClick={() => apiRef.current?.setView(preset)}>
            {t(`view.${preset}`)}
          </button>
        ))}
        <button type="button" onClick={() => apiRef.current?.fit()}>
          {t('view.fit')}
        </button>
        <label>
          <input
            type="checkbox"
            checked={viewOptions.showFronts}
            onChange={(e) => {
              editor.getState().setViewOptions({ showFronts: e.target.checked });
            }}
          />
          {t('view.showFronts')}
        </label>
        <label>
          <input
            type="checkbox"
            checked={viewOptions.showBack}
            onChange={(e) => {
              editor.getState().setViewOptions({ showBack: e.target.checked });
            }}
          />
          {t('view.showBack')}
        </label>
      </div>
      <div className="viewport-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="viewport-canvas"
          role="img"
          aria-label={t('view.canvasLabel', { name: doc.name, w: widthMm, h: heightMm, d: depthMm })}
          data-testid="viewport-canvas"
        />
        {derived && !derived.ok && (
          <div className="viewport-overlay" role="alert">
            {t('view.layoutError')}
          </div>
        )}
        {hoveredPart && (
          <div className="viewport-hover" data-testid="viewport-hover">
            {t('view.hover', {
              position: String(positions.get(hoveredPart.id) ?? '–'),
              name: t(`role.${hoveredPart.role}`),
            })}
          </div>
        )}
      </div>
    </div>
  );
}
