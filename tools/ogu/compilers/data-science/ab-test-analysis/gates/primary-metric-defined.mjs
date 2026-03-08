import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * AB005 — primary-metric-defined
 * A/B tests must declare a single primary metric that determines success or failure.
 *
 * Why:
 * - Multiple primary metrics without a declared winner create HARKing risk:
 *   you run the test, check 5 metrics, and declare whichever improved as
 *   "the primary metric" — inflating type I error rate.
 * - A pre-declared primary metric forces the team to commit to what matters
 *   BEFORE seeing results. This commitment is the difference between a
 *   pre-registered trial and data mining.
 * - Secondary metrics can still be tracked, but they're hypothesis-generating
 *   for future tests — they don't determine this test's outcome.
 * - If no primary metric is pre-declared, stakeholders will argue about results:
 *   "but conversion went up!" vs "but revenue went down!" — with no resolution.
 *
 * The primary metric must be:
 * - Quantitative (measurable, not qualitative)
 * - Directly tied to the experiment hypothesis
 * - Pre-declared before data collection begins
 *
 * Escape hatch: none — every A/B test must have exactly one primary metric.
 */

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'ab-test-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'AB005', message: 'ab-test-spec.json not readable' }; }

  const primary = spec.primary_metric ?? spec.success_metric ?? spec.primary_kpi;

  if (!primary) {
    return {
      pass: false, code: 'AB005',
      message: 'No primary_metric declared in ab-test-spec.json',
      detail: 'Add to ab-test-spec.json:\n' +
        '  "primary_metric": "conversion_rate"\n\n' +
        'Secondary metrics (informational only):\n' +
        '  "secondary_metrics": ["revenue_per_user", "session_duration", "churn_rate"]\n\n' +
        'The primary metric is the single determinant of test success. Choose before running.',
    };
  }

  if (Array.isArray(primary) && primary.length > 1) {
    return {
      pass: false, code: 'AB005',
      message: `Multiple primary metrics declared (${primary.length}) — must have exactly one`,
      detail: `Declared: ${primary.join(', ')}\n\nChoose ONE as primary. Move others to secondary_metrics[].\nHaving multiple primaries inflates false positive rate.`,
    };
  }

  const metricName = Array.isArray(primary) ? primary[0] : primary;

  // Check for minimum required direction or effect declaration
  const hasDirection = spec.expected_direction ?? spec.hypothesis_direction ?? spec.min_detectable_effect;
  if (!hasDirection) {
    return {
      pass: false, code: 'AB005',
      message: `Primary metric declared but no expected direction or MDE specified`,
      detail: `Add to ab-test-spec.json:\n  "primary_metric": "${metricName}",\n  "expected_direction": "increase",\n  "min_detectable_effect": 0.02`,
    };
  }

  return {
    pass: true, code: 'AB005',
    message: `Primary metric: "${metricName}" (${spec.expected_direction ?? 'direction unspecified'})`,
  };
}
