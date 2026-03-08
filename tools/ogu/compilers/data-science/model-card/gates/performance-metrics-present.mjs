import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * MC004 — performance-metrics-present
 * Model cards must report quantitative performance metrics on a held-out
 * evaluation dataset with a declared evaluation methodology.
 *
 * Why:
 * - "The model performs well" is not a performance claim. Performance claims
 *   must be quantitative, tied to a specific dataset, and reproducible.
 * - Performance metrics in model cards serve as the public record of model
 *   quality at deployment time. They are the baseline against which
 *   production drift is measured.
 * - Metrics must include: the metric name (F1, AUC, RMSE), the value,
 *   the dataset it was evaluated on, and the date of evaluation.
 *   Without the dataset reference, the metric is uninterpretable.
 *
 * Escape hatch: add "metricsConfidential": true to model-card-spec.json
 * for models where performance metrics are commercially sensitive.
 */


export async function run({ dir }) {
  const candidates = ['MODEL_CARD.md', 'model-card.md', 'model_card.md', 'ModelCard.md'];
  const cardPath = candidates.map(c => join(dir, c)).find(p => existsSync(p));

  if (!cardPath) return { pass: false, code: 'MC004', message: 'MODEL_CARD.md not found' };

  const content = readFileSync(cardPath, 'utf8');
  const violations = [];

  // Must contain actual numeric metrics (not just metric names)
  const hasNumericMetric = /\d+\.?\d*\s*%|accuracy[:\s]+\d|precision[:\s]+\d|recall[:\s]+\d|f1[:\s]+\d|auc[:\s]+\d|rmse[:\s]+\d|mae[:\s]+\d|r²?\s*[=:]\s*\d|\|\s*\d+\.?\d+\s*\|/i.test(content);

  if (!hasNumericMetric) {
    violations.push('No numeric performance metrics found — model card must include actual numbers, not just metric names');
  }

  // Must specify which dataset the metrics were evaluated on
  const hasEvalDataset = /test\s+set|evaluation\s+set|held.out|val(idation)?\s+set|test\s+split|\d+\s+(samples|examples|instances)/i.test(content);
  if (!hasEvalDataset) {
    violations.push('Evaluation dataset not specified — state the dataset/split used for metrics');
  }

  // Should mention baseline or comparison
  const hasBaseline = /baseline|dummy|random|majority\s+class|naive|compared\s+to|vs\.?\s+\w/i.test(content);
  if (!hasBaseline) {
    violations.push('No baseline comparison — model card should compare against a baseline');
  }

  if (violations.length) {
    return {
      pass: false, code: 'MC004',
      message: `Performance metrics section incomplete`,
      detail: violations.join('\n')
    };
  }

  return { pass: true, code: 'MC004', message: 'Performance metrics with numeric values and baseline present' };
}
