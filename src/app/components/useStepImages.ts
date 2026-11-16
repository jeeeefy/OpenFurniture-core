import { useEffect, useState } from 'react';
import type { AssemblyStep, FurnitureModel } from '@/domain';
import { renderStepImages } from '@/render3d/stepImages';
import type { StepImage } from './StepView';

/** Renders all step illustrations once per step list; missing images become placeholders. */
export function useStepImages(model: FurnitureModel, steps: readonly AssemblyStep[]) {
  const [rendered, setRendered] = useState<{ steps: readonly AssemblyStep[]; urls: Map<number, string> } | null>(null);
  const pending = rendered?.steps !== steps;

  useEffect(() => {
    let cancelled = false;
    void renderStepImages(model, steps)
      .catch(() => new Map<number, string>())
      .then((urls) => {
        if (!cancelled) setRendered({ steps, urls });
      });
    return () => {
      cancelled = true;
    };
  }, [model, steps]);

  const imageOf = (index: number): StepImage => {
    if (pending) return { status: 'pending' };
    const url = rendered.urls.get(index);
    return url === undefined ? { status: 'unavailable' } : { status: 'ready', url };
  };
  return { pending, imageOf };
}
