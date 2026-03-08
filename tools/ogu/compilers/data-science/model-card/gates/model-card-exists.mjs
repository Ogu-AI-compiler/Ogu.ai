import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * MC001 — model-card-exists
 * A MODEL_CARD.md file must exist in the model-card compiler directory.
 *
 * Why:
 * - Model cards are the primary documentation artifact for ML models.
 *   Without a model card, there is no structured place to document
 *   intended use, performance, limitations, and fairness considerations.
 * - Model cards were proposed by Google (Mitchell et al., 2019) and are
 *   now required by major ML governance frameworks and responsible AI policies.
 * - The file must exist BEFORE the model is registered or deployed.
 *   Creating a card after deployment is retrospective documentation —
 *   it cannot capture the reasoning that went into deployment decisions.
 *
 * Escape hatch: none — model cards are mandatory for all production models.
 */


export async function run({ dir }) {
  // Check for MODEL_CARD.md or model-card.md
  const candidates = ['MODEL_CARD.md', 'model-card.md', 'model_card.md', 'ModelCard.md'];
  const found = candidates.find(c => existsSync(join(dir, c)));

  if (!found) {
    return {
      pass: false, code: 'MC002',
      message: 'MODEL_CARD.md not found',
      detail: 'Create MODEL_CARD.md with sections: Model Details, Intended Use, Training Data, Evaluation Results, Ethical Considerations, Limitations'
    };
  }

  const content = readFileSync(join(dir, found), 'utf8');
  if (content.trim().length < 200) {
    return {
      pass: false, code: 'MC002',
      message: `${found} exists but is too short (${content.trim().length} chars) — model card must be substantive`,
      detail: 'A complete model card requires meaningful content in each section'
    };
  }

  return { pass: true, code: 'MC002', message: `Model card found: ${found} (${content.trim().length} chars)` };
}
