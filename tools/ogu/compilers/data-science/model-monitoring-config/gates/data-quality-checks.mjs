import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * MM005 — data-quality-checks
 * Model monitoring must include data quality checks on incoming production data,
 * separate from drift detection.
 *
 * Why:
 * - Drift detection answers: "did the distribution change?"
 *   Data quality checks answer: "is the data valid at all?"
 *   These are different failure modes requiring different responses.
 * - Common production data quality failures:
 *   - A feature pipeline bug sets all values of a column to 0
 *   - A joining operation produces unexpected NULLs
 *   - A downstream API starts returning strings instead of numbers
 *   - A feature computation produces infinite or NaN values
 * - Data quality failures cause immediate silent model degradation without
 *   triggering drift alerts (the distribution is "different" but the alert
 *   may not fire if the degradation is within threshold).
 *
 * Required checks: null_rate, value_range, completeness, or custom checks.
 * Monitoring config must declare data_quality_checks array.
 *
 * Escape hatch: add "dataQualityExternal": true if data quality is enforced
 * by the feature store or upstream pipeline (e.g., Great Expectations in ETL).
 */

const VALID_CHECK_TYPES = new Set([
  'null_rate', 'value_range', 'completeness', 'schema_match',
  'uniqueness', 'referential_integrity', 'custom', 'expectations_suite',
]);

export async function run({ dir }) {
  let config;
  try { config = JSON.parse(readFileSync(join(dir, 'monitoring-config.json'), 'utf8')); }
  catch { return { pass: false, code: 'MM005', message: 'monitoring-config.json not readable' }; }

  if (config.dataQualityExternal === true) {
    return { pass: true, code: 'MM005', message: 'Data quality enforced upstream (external)', skipped: true };
  }

  const checks = config.data_quality_checks;
  if (!checks || !Array.isArray(checks) || checks.length === 0) {
    return {
      pass: false, code: 'MM005',
      message: 'No data_quality_checks declared in monitoring-config.json',
      detail: 'Add to monitoring-config.json:\n' +
        '  "data_quality_checks": [\n' +
        '    {\n' +
        '      "type": "null_rate",\n' +
        '      "features": ["age", "income"],\n' +
        '      "max_null_rate": 0.05,\n' +
        '      "action": "alert"\n' +
        '    },\n' +
        '    {\n' +
        '      "type": "value_range",\n' +
        '      "feature": "age",\n' +
        '      "min": 0, "max": 120\n' +
        '    }\n' +
        '  ]',
    };
  }

  const issues = [];
  for (const [i, c] of checks.entries()) {
    if (!c.type) {
      issues.push(`data_quality_checks[${i}]: missing "type"`);
    } else if (!VALID_CHECK_TYPES.has(c.type)) {
      issues.push(`data_quality_checks[${i}]: unknown type "${c.type}"`);
    }
    if (!c.action && c.type !== 'expectations_suite') {
      // action can be implicit for some types
    }
  }

  if (issues.length) {
    return {
      pass: false, code: 'MM005',
      message: `${issues.length} issue(s) in data_quality_checks`,
      detail: issues.join('\n'),
    };
  }

  return {
    pass: true, code: 'MM005',
    message: `${checks.length} data quality check(s): ${checks.map(c => c.type).join(', ')}`,
  };
}
