import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * MC006 — bias-fairness-documented
 * Model cards must document bias analysis, fairness considerations, and
 * limitations for demographic or contextual subgroups.
 *
 * Why:
 * - ML models trained on historical data inherit historical biases.
 *   A model card that doesn't acknowledge this is either misleading or naive.
 * - Regulatory frameworks (EU AI Act, US Executive Order on AI) require
 *   bias documentation for high-risk AI systems.
 * - Undocumented bias becomes undiscoverable bias: without a bias analysis
 *   section, users of the model have no way to know which subgroups the
 *   model underserves or where it should not be deployed.
 * - The goal is not to have a bias-free model (impossible) but to have an
 *   honest, documented understanding of the model's fairness properties.
 *
 * Escape hatch: add "biasAnalysisExternal": true to model-card-spec.json
 * if bias analysis is documented in a separate fairness audit report.
 */

export async function run({ dir }) {
  const candidates = ['MODEL_CARD.md', 'model-card.md', 'model_card.md', 'ModelCard.md'];
  const cardPath = candidates.map(c => join(dir, c)).find(p => existsSync(p));

  if (!cardPath) return { pass: false, code: 'MC006', message: 'MODEL_CARD.md not found' };

  const content = readFileSync(cardPath, 'utf8');
  const violations = [];

  // Must have an ethical considerations or bias section
  const hasEthicsSection = /##?\s+(ethic|bias|fairness|social\s+impact|responsible|equity)/i.test(content);
  if (!hasEthicsSection) {
    violations.push('No ethics/bias section found — required in all model cards');
  }

  // Bias analysis: must mention either groups, demographic, or analysis type
  const hasBiasAnalysis = /bias|demographic|gender|race|age|geography|religion|disparate\s+impact|subgroup|slice/i.test(content);
  if (!hasBiasAnalysis) {
    violations.push('No bias analysis — mention which demographic groups were analyzed and results');
  }

  // Should acknowledge limitations related to fairness
  const hasFairnessLimitations = /may\s+(not|perform|generalize)|performance\s+(varies|differs|degrades)|underrepresent|overrepresent|historically\s+biased|known\s+limitation/i.test(content);
  if (!hasFairnessLimitations) {
    violations.push('No fairness limitations acknowledged — be explicit about who the model may underserve');
  }

  if (violations.length) {
    return {
      pass: false, code: 'MC006',
      message: `Bias/fairness documentation incomplete`,
      detail: violations.join('\n')
    };
  }

  return { pass: true, code: 'MC006', message: 'Bias and fairness considerations documented' };
}
