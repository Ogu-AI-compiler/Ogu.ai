import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA044 — error-rate-defined
 * At least one scenario must declare an explicit error rate threshold.
 *
 * An error rate threshold defines the maximum acceptable percentage of
 * failed requests before the test is considered a failure. Without it,
 * a test can "pass" with p95=200ms while 30% of requests are returning 500.
 *
 * Rules:
 *   - At least one non-smoke scenario must have thresholds.errorRate declared
 *   - errorRate must be between 0.0 and 1.0 (not a percentage like 5 — that is 500%)
 *   - errorRate > 0.05 (5%) warrants a warning — most production targets are < 1%
 *
 * Smoke scenarios are exempt.
 */

const ERROR_RATE_WARNING_THRESHOLD = 0.05;

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'load-test-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA044', message: 'load-test-spec.json not readable' }; }

  const nonSmoke = (spec.scenarios ?? []).filter(s => s.type !== 'smoke');
  if (nonSmoke.length === 0) {
    return { pass: true, code: 'QA044', message: 'No non-smoke scenarios — skipped', skipped: true };
  }

  const withErrorRate = nonSmoke.filter(s => s.thresholds?.errorRate !== undefined);

  if (withErrorRate.length === 0) {
    return {
      pass: false, code: 'QA044',
      message: 'No scenario declares errorRate threshold — response time alone is insufficient',
      detail: 'A test can achieve good p95 latency while serving errors to 30% of users.\nAdd to at least one scenario:\n  "thresholds": { "errorRate": 0.01 }  // 1% max error rate',
    };
  }

  const errors = [];
  for (const s of withErrorRate) {
    const r = s.thresholds.errorRate;
    if (typeof r !== 'number') {
      errors.push(`Scenario "${s.id}": errorRate must be a number (got ${typeof r})`);
      continue;
    }
    if (r < 0 || r > 1) {
      errors.push(`Scenario "${s.id}": errorRate ${r} out of range — must be 0.0–1.0 (e.g. 0.01 = 1%, not 1 = 100%)`);
    }
    if (r > ERROR_RATE_WARNING_THRESHOLD) {
      errors.push(`Scenario "${s.id}": errorRate ${r} (${(r * 100).toFixed(1)}%) is high — most production targets are < 1%`);
    }
  }

  if (errors.length) {
    return {
      pass: false, code: 'QA044',
      message: `${errors.length} errorRate issue(s) found`,
      detail: errors.join('\n'),
    };
  }

  return {
    pass: true, code: 'QA044',
    message: `${withErrorRate.length} scenario(s) declare errorRate threshold`,
  };
}
