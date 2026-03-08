import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA043 — thresholds-per-scenario
 * Every non-smoke scenario must declare explicit pass/fail thresholds.
 *
 * Without per-scenario thresholds, load test results are observational only —
 * the CI pipeline has no objective criteria to pass or fail the run.
 *
 * Required threshold shape (any subset of these, but at least one):
 *   thresholds.p95ResponseTime  — 95th percentile response time in ms
 *   thresholds.p99ResponseTime  — 99th percentile response time in ms
 *   thresholds.errorRate        — max acceptable error rate (0.0–1.0)
 *   thresholds.rps              — minimum requests per second achieved
 *
 * Smoke scenarios are exempt — they validate the script, not performance.
 */

const THRESHOLD_KEYS = ['p95ResponseTime', 'p99ResponseTime', 'errorRate', 'rps', 'avgResponseTime'];

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'load-test-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA043', message: 'load-test-spec.json not readable' }; }

  const nonSmoke = (spec.scenarios ?? []).filter(s => s.type !== 'smoke');

  if (nonSmoke.length === 0) {
    return { pass: true, code: 'QA043', message: 'No non-smoke scenarios — skipped', skipped: true };
  }

  const missing = [];
  for (const s of nonSmoke) {
    if (!s.thresholds || typeof s.thresholds !== 'object') {
      missing.push(`Scenario "${s.id}" (type: ${s.type}): no thresholds declared`);
      continue;
    }
    const declared = THRESHOLD_KEYS.filter(k => s.thresholds[k] !== undefined);
    if (declared.length === 0) {
      missing.push(`Scenario "${s.id}": thresholds object is empty — add at least one of: ${THRESHOLD_KEYS.join(', ')}`);
    }
  }

  if (missing.length) {
    return {
      pass: false, code: 'QA043',
      message: `${missing.length} scenario(s) missing thresholds`,
      detail: missing.join('\n') + '\n\nExample:\n  "thresholds": { "p95ResponseTime": 500, "errorRate": 0.01 }',
    };
  }

  const thresholdCount = nonSmoke.reduce((n, s) => n + Object.keys(s.thresholds ?? {}).length, 0);
  return {
    pass: true, code: 'QA043',
    message: `${nonSmoke.length} non-smoke scenario(s) have thresholds (${thresholdCount} total)`,
  };
}
