import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA047 — baseline-comparison
 * Load test results should be compared to a known baseline to detect regressions.
 *
 * Without baseline comparison, every run is evaluated in isolation — a 50% throughput
 * regression passes as long as it still meets the absolute threshold.
 *
 * Baseline comparison options:
 *   spec.baseline.enabled: true                — comparison is active
 *   spec.baseline.source: "previous-run"       — compare against last passing run
 *   spec.baseline.source: "file"               — compare against a committed baseline file
 *   spec.baseline.source: "rolling-average"    — compare against N-run average
 *   spec.baseline.regressionThreshold: 0.15    — fail if metric degrades > 15%
 *
 * If spec.baseline is not declared at all, this gate passes with a warning.
 * If spec.baseline.enabled: false, it also passes (explicit opt-out).
 * If declared but misconfigured, it fails.
 */

const VALID_SOURCES = new Set(['previous-run', 'file', 'rolling-average', 'manual', 'none']);

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'load-test-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA047', message: 'load-test-spec.json not readable' }; }

  const baseline = spec.baseline;

  // Not declared — soft skip
  if (baseline === undefined || baseline === null) {
    return {
      pass: true, code: 'QA047',
      message: 'baseline not declared — no regression detection (consider adding spec.baseline)',
      skipped: true,
    };
  }

  // Explicit opt-out
  if (baseline.enabled === false || baseline.source === 'none') {
    return { pass: true, code: 'QA047', message: 'baseline comparison explicitly disabled' };
  }

  // Declared but source missing
  if (!baseline.source) {
    return {
      pass: false, code: 'QA047',
      message: 'baseline.source is required when baseline is declared',
      detail: `Valid sources: ${[...VALID_SOURCES].join(', ')}`,
    };
  }

  if (!VALID_SOURCES.has(baseline.source)) {
    return {
      pass: false, code: 'QA047',
      message: `baseline.source "${baseline.source}" not recognised`,
      detail: `Valid sources: ${[...VALID_SOURCES].join(', ')}`,
    };
  }

  // Regression threshold validation
  const threshold = baseline.regressionThreshold;
  if (threshold !== undefined) {
    if (typeof threshold !== 'number' || threshold <= 0 || threshold >= 1) {
      return {
        pass: false, code: 'QA047',
        message: `baseline.regressionThreshold ${threshold} invalid — must be between 0.0 and 1.0 (e.g. 0.15 = 15%)`,
      };
    }
    if (threshold > 0.5) {
      return {
        pass: false, code: 'QA047',
        message: `baseline.regressionThreshold ${threshold} (${(threshold * 100).toFixed(0)}%) is too lenient — typical target is ≤ 20%`,
      };
    }
  }

  const thresholdStr = threshold !== undefined ? `, regressionThreshold: ${(threshold * 100).toFixed(0)}%` : '';
  return {
    pass: true, code: 'QA047',
    message: `baseline comparison enabled — source: ${baseline.source}${thresholdStr}`,
  };
}
