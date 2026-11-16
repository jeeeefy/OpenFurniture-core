import { positionByPartId, toolRef, type AssemblyStep, type FurnitureModel, type Outputs } from '@/domain';
import { translateRef } from '@/i18n';
import { useT } from '@/i18n/useT';
import { StepView, type StepImage } from './StepView';
import { useStepImages } from './useStepImages';

export function ToolsList({ outputs, headingLevel = 3 }: { outputs: Outputs; headingLevel?: 2 | 3 }) {
  const { t, locale } = useT();
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <section aria-labelledby="tools-heading" className="tools-list">
      <Heading id="tools-heading">{t('steps.toolsHeading')}</Heading>
      <ul data-testid="tools-list">
        {outputs.tools.map((tool) => (
          <li key={tool} data-tool={tool}>
            {translateRef(locale, toolRef(tool))}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Steps grouped by phase (plan §6.4). */
export function StepList({
  model,
  outputs,
  imageOf,
}: {
  model: FurnitureModel;
  outputs: Outputs;
  imageOf: (index: number) => StepImage;
}) {
  const { t } = useT();
  const partsById = new Map(model.parts.map((p) => [p.id, p]));
  const positionOf = positionByPartId(outputs.positions);
  const steps: readonly AssemblyStep[] = outputs.steps;
  const phases = [...new Set(steps.map((s) => s.phase))];
  return (
    <>
      {phases.map((phase) => (
        <section key={phase} aria-labelledby={`phase-${phase}`} className="assembly-phase">
          <h3 id={`phase-${phase}`}>{t(`steps.phase.${phase}`)}</h3>
          {steps
            .filter((s) => s.phase === phase)
            .map((step) => (
              <StepView
                key={step.index}
                step={step}
                image={imageOf(step.index)}
                partsById={partsById}
                positionOf={positionOf}
                hardwareRows={outputs.hardware}
              />
            ))}
        </section>
      ))}
    </>
  );
}

/** Instructions tab: tools list, then the steps with their illustrations or placeholders. */
export function Instructions({ model, outputs }: { model: FurnitureModel; outputs: Outputs }) {
  const { pending, imageOf } = useStepImages(model, outputs.steps);
  return (
    <div className="instructions" data-images={pending ? 'pending' : 'done'}>
      <ToolsList outputs={outputs} />
      <StepList model={model} outputs={outputs} imageOf={imageOf} />
    </div>
  );
}
