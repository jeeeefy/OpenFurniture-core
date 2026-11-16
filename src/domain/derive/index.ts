import { checkReferences } from '../document/references';
import type { DesignDocument, MaterialGroup } from '../document/types';
import { materialById, resolveDimensions, resolveLayout } from '../layout/resolveLayout';
import { checkDocument, checkModel } from '../validate';
import { sortIssues } from '../validate/catalogue';
import { deriveBack, deriveCarcass } from './carcass';
import type { DeriveContext } from './context';
import { deriveDoors } from './doors';
import { deriveDrawers, drawerLayouts } from './drawers';
import { deriveInterior, railFittings } from './interior';
import type { DeriveResult, Envelope, Part } from './model';
import { checkPlinth, derivePlinth } from './plinth';
import { applyRules } from '../rules';

function envelopeOf(doc: DesignDocument): Envelope {
  const { widthMm, heightMm, depthMm } = doc.carcass;
  const hasFronts = doc.layout.columns.some((c) => c.sections.some((s) => s.front.kind !== 'none'));
  const tFr = materialById(doc, doc.carcass.materialIds.fronts)?.thicknessMm ?? 0;
  return { widthMm, heightMm, depthMm, depthWithFrontsMm: hasFronts ? depthMm + tFr : depthMm };
}

/** L-13: replace the role defaults with the stored edge set; ignore stale ids and materials without banding. */
function applyBandingOverrides(doc: DesignDocument, parts: readonly Part[]): Part[] {
  const overrides = doc.bandingOverrides;
  if (!overrides) return [...parts];
  return parts.map((part) => {
    const edges = overrides[part.id];
    if (!edges) return part;
    const material = materialById(doc, part.materialId);
    if (!material?.edgeBand) return part;
    return { ...part, bandedEdges: [...edges].sort() };
  });
}

/** Pure and deterministic; never throws for schema-valid input. */
export function deriveModel(doc: DesignDocument): DeriveResult {
  const envelope = envelopeOf(doc);
  const references = checkReferences(doc);
  if (references.length > 0) return { ok: false, issues: sortIssues(references), envelope };

  const dims = resolveDimensions(doc);
  const documentIssues = [...checkDocument(doc), ...checkPlinth(doc)];
  const resolved = resolveLayout(doc, dims);
  if (!resolved.ok) return { ok: false, issues: sortIssues([...resolved.issues, ...documentIssues]), envelope };

  const material = (group: MaterialGroup) => {
    const found = materialById(doc, doc.carcass.materialIds[group]);
    if (!found) throw new Error(`Unresolved material for ${group}`);
    return found;
  };
  const ctx: DeriveContext = { doc, dims, layout: resolved.layout, material };
  const drawers = drawerLayouts(ctx);
  const baseParts = [
    ...deriveCarcass(ctx),
    ...deriveInterior(ctx),
    ...deriveBack(ctx),
    ...derivePlinth(ctx),
    ...deriveDoors(ctx),
    ...deriveDrawers(ctx, drawers.drawers),
  ];
  const parts = applyBandingOverrides(doc, baseParts);
  const rules = applyRules({ ...ctx, parts: new Map(parts.map((p) => [p.id, p])), drawers: drawers.drawers }, parts);

  return {
    ok: true,
    model: {
      envelope,
      layout: resolved.layout,
      parts,
      rails: railFittings(ctx),
      joints: rules.joints,
      holes: rules.holes,
      marks: rules.marks,
      hardware: rules.hardware,
      issues: sortIssues([...documentIssues, ...drawers.issues, ...checkModel(ctx, parts), ...rules.issues]),
    },
  };
}
