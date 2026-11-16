import { describe, expect, it } from 'vitest';
import { canonicalJson, deriveModel, generateOutputs, TEMPLATE_IDS } from '@/domain';
import { template } from './domain/fixtures';

// Regenerate only deliberately (`npx vitest run -u`) and record the reason in docs/progress.md.
describe('golden files (AC-041)', () => {
  it.each(TEMPLATE_IDS)('%s', async (id) => {
    const doc = template(id);
    const result = deriveModel(doc);
    if (!result.ok) throw new Error(`${id} does not derive`);
    const json = canonicalJson({ model: result.model, outputs: generateOutputs(doc, result.model) });
    await expect(`${json}\n`).toMatchFileSnapshot(`../golden/${id}.golden.json`);
  });
});
