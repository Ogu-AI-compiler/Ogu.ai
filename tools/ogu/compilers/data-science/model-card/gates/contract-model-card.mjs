import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * MC009 — contract-model-card
 * Verifies that model cards satisfy the model card contract:
 * card exists, numeric metrics, limitations documented, intended use,
 * and training data section present.
 *
 * Why:
 * - A model card without numeric performance metrics cannot be used to make
 *   deployment decisions: "performs well" is not a deployment criterion.
 * - Limitations documentation is the most important section of a model card:
 *   it tells deployers what NOT to do, preventing misuse in contexts where
 *   the model's known failure modes would cause harm.
 * - Intended use documentation distinguishes the model's design context from
 *   adjacent uses that may look plausible but where the model will fail.
 * - Training data section enables data lineage tracking and informs decisions
 *   about whether the model is appropriate for a new deployment context.
 *
 * Escape hatch: none — these are non-negotiable for production model cards.
 */

const RULES = [
  {
    id: 'model-card-exists',
    description: 'MODEL_CARD.md exists',
    test: (cardContent, _spec) => cardContent !== null
  },
  {
    id: 'has-numeric-metrics',
    description: 'Contains numeric performance metrics',
    test: (cardContent, _spec) => cardContent !== null &&
      /\d+\.?\d*\s*%|accuracy[:\s]+\d|\|\s*\d+\.?\d+\s*\|/i.test(cardContent)
  },
  {
    id: 'has-limitations',
    description: 'Documents model limitations',
    test: (cardContent, _spec) => cardContent !== null &&
      /limitation|caveat|not\s+intended|should\s+not|out.of.scope/i.test(cardContent)
  },
  {
    id: 'has-intended-use',
    description: 'Intended use is documented',
    test: (cardContent, spec) => {
      if (spec && spec.intended_use && spec.intended_use.length >= 20) return true;
      return cardContent !== null && /intended\s+use|use\s+cases?|designed\s+for/i.test(cardContent);
    }
  },
  {
    id: 'has-training-data-section',
    description: 'Training data section present',
    test: (cardContent, _spec) => cardContent !== null &&
      /training\s+data|dataset|data\s+used/i.test(cardContent)
  },
];

export async function run({ dir }) {
  const candidates = ['MODEL_CARD.md', 'model-card.md', 'model_card.md', 'ModelCard.md'];
  const cardPath = candidates.map(c => join(dir, c)).find(p => existsSync(p));
  const cardContent = cardPath ? readFileSync(cardPath, 'utf8') : null;

  const specPath = join(dir, 'model-card-spec.json');
  let spec = null;
  if (existsSync(specPath)) {
    try { spec = JSON.parse(readFileSync(specPath, 'utf8')); } catch {}
  }

  const violations = RULES.filter(r => !r.test(cardContent, spec));

  if (violations.length) {
    return {
      pass: false, code: 'MC009',
      message: `Contract violations: ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n')
    };
  }

  return { pass: true, code: 'MC009', message: 'All model-card contract rules passed' };
}
