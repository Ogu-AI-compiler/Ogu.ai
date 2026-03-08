import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * MC002 — required-sections
 * Model cards must contain all required sections as defined by the
 * Google Model Card framework and responsible AI best practices.
 *
 * Why:
 * - Incomplete model cards provide false assurance. A card with only
 *   "Model Description" and "Performance" but no "Limitations" or
 *   "Ethical Considerations" is worse than no card — it implies that
 *   these dimensions were considered and found unimportant.
 * - The required sections map to the lifecycle of a model:
 *   Overview → Training → Evaluation → Deployment → Ethics
 *   Each section corresponds to a decision point where documentation matters.
 * - Regulatory bodies reviewing AI systems will look for all sections.
 *   A model with missing sections fails compliance review.
 *
 * Escape hatch: add "sectionExceptions": ["Ethical Considerations"] to
 * model-card-spec.json for sections that are genuinely not applicable.
 */


const REQUIRED_SECTIONS = [
  { key: 'model-details', patterns: [/##?\s+(model\s+details|model\s+description|about\s+the\s+model)/i] },
  { key: 'intended-use', patterns: [/##?\s+(intended\s+use|use\s+cases?|applications?)/i] },
  { key: 'training-data', patterns: [/##?\s+(training\s+data|dataset|data\s+used)/i] },
  { key: 'evaluation', patterns: [/##?\s+(eval(uation)?|performance|results?|metrics?)/i] },
  { key: 'limitations', patterns: [/##?\s+(limitation|caveats?|known\s+issue|shortcoming)/i] },
  { key: 'ethical', patterns: [/##?\s+(ethic|bias|fairness|social\s+impact|responsible)/i] },
];

export async function run({ dir }) {
  const candidates = ['MODEL_CARD.md', 'model-card.md', 'model_card.md', 'ModelCard.md'];
  const cardPath = candidates.map(c => join(dir, c)).find(p => existsSync(p));

  if (!cardPath) return { pass: false, code: 'MC003', message: 'MODEL_CARD.md not found' };

  const content = readFileSync(cardPath, 'utf8');
  const missingSections = REQUIRED_SECTIONS.filter(s =>
    !s.patterns.some(pattern => pattern.test(content))
  );

  if (missingSections.length) {
    return {
      pass: false, code: 'MC003',
      message: `Model card missing required sections: ${missingSections.map(s => s.key).join(', ')}`,
      detail: 'Required sections: Model Details, Intended Use, Training Data, Evaluation, Limitations, Ethical Considerations'
    };
  }

  return { pass: true, code: 'MC003', message: `All ${REQUIRED_SECTIONS.length} required sections present in model card` };
}
