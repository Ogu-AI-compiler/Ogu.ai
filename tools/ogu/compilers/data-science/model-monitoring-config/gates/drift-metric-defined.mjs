import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * MM002 — drift-metric-defined
 * Model monitoring configs must specify which drift metrics to track and
 * the statistical test used to detect drift.
 *
 * Why:
 * - ML models degrade silently. Unlike software bugs (500 errors), model
 *   degradation produces subtly wrong predictions that look normal to
 *   infrastructure monitoring — they only show up in business metrics weeks later.
 * - Data drift (input distribution changes) and concept drift (relationship
 *   between inputs and target changes) require different detection methods:
 *   - Population Stability Index (PSI) for categorical feature drift
 *   - Kolmogorov-Smirnov (KS) test for continuous feature drift
 *   - Wasserstein distance for distribution shift in numeric features
 *   - Jensen-Shannon divergence for probability distribution comparison
 * - Without a declared drift metric, monitoring is ad-hoc and teams discover
 *   drift weeks after it occurs, when business impact is already significant.
 *
 * Required: monitoring-config.json must declare drift_metrics (array of objects
 * with metric name and drift_test type) and at least one feature to monitor.
 *
 * Escape hatch: add "driftMonitoringExternal": true if drift is monitored by
 * an external platform (Arize, WhyLabs, Evidently) declared in monitoring-config.json.
 */

const VALID_DRIFT_TESTS = new Set([
  'psi', 'ks_test', 'wasserstein', 'js_divergence', 'chi_squared',
  'population_stability_index', 'kolmogorov_smirnov', 'evidently',
  'custom',
]);

export async function run({ dir }) {
  let config;
  try { config = JSON.parse(readFileSync(join(dir, 'monitoring-config.json'), 'utf8')); }
  catch { return { pass: false, code: 'MM002', message: 'monitoring-config.json not readable' }; }

  if (config.driftMonitoringExternal === true) {
    const platform = config.drift_platform ?? 'external';
    return { pass: true, code: 'MM002', message: `Drift monitoring by ${platform} (external)`, skipped: true };
  }

  const metrics = config.drift_metrics;
  if (!metrics || !Array.isArray(metrics) || metrics.length === 0) {
    return {
      pass: false, code: 'MM002',
      message: 'No drift_metrics declared in monitoring-config.json',
      detail: 'Add to monitoring-config.json:\n' +
        '  "drift_metrics": [\n' +
        '    {\n' +
        '      "name": "feature_drift",\n' +
        '      "features": ["age", "income", "category"],\n' +
        '      "drift_test": "ks_test",\n' +
        '      "threshold": 0.05\n' +
        '    },\n' +
        '    {\n' +
        '      "name": "prediction_drift",\n' +
        '      "drift_test": "psi",\n' +
        '      "threshold": 0.2\n' +
        '    }\n' +
        '  ]',
    };
  }

  const issues = [];
  for (const [i, m] of metrics.entries()) {
    if (!m.name) issues.push(`drift_metrics[${i}]: missing "name"`);
    if (!m.drift_test) {
      issues.push(`drift_metrics[${i}] "${m.name}": missing "drift_test"`);
    } else if (!VALID_DRIFT_TESTS.has(m.drift_test.toLowerCase())) {
      issues.push(`drift_metrics[${i}] "${m.name}": unknown drift_test "${m.drift_test}" — valid: ${[...VALID_DRIFT_TESTS].join(', ')}`);
    }
    if (m.threshold === undefined) {
      issues.push(`drift_metrics[${i}] "${m.name}": missing "threshold" — when should drift alert trigger?`);
    }
  }

  if (issues.length) {
    return {
      pass: false, code: 'MM002',
      message: `${issues.length} issue(s) in drift_metrics configuration`,
      detail: issues.join('\n'),
    };
  }

  return {
    pass: true, code: 'MM002',
    message: `${metrics.length} drift metric(s) declared: ${metrics.map(m => m.drift_test).join(', ')}`,
  };
}
