import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA035 — lighthouse-runs-sufficient
 * Lighthouse CI must run each URL at least 3 times.
 *
 * A single Lighthouse run has variance of ±5–15 points depending on
 * machine load, network simulation accuracy, and background tasks.
 * With 3 runs, the median is used — much more stable.
 * With 1 run, you cannot distinguish a real regression from noise.
 *
 * If lighthouseThresholds is not declared, this gate is skipped.
 */

const MIN_RUNS = 3;

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'performance-budget-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA035', message: 'performance-budget-spec.json not readable' }; }

  if (!spec.lighthouseThresholds) {
    return { pass: true, code: 'QA035', message: 'lighthouseThresholds not declared — skipped', skipped: true };
  }

  const runs = spec.lighthouseRuns ?? spec.numberOfRuns ?? spec.lighthouse?.runs ?? spec.lighthouse?.numberOfRuns;

  if (runs === undefined || runs === null) {
    return {
      pass: false, code: 'QA035',
      message: 'lighthouseRuns not declared — single-run Lighthouse scores have high variance',
      detail: `Add "lighthouseRuns": 3 to the spec. With fewer than ${MIN_RUNS} runs, a 10-point score swing is noise, not a regression.`,
    };
  }

  if (typeof runs !== 'number' || runs < MIN_RUNS) {
    return {
      pass: false, code: 'QA035',
      message: `lighthouseRuns: ${runs} — must be ≥ ${MIN_RUNS} for statistical reliability`,
      detail: `With ${runs} run(s), score variance makes it impossible to detect real regressions vs measurement noise.`,
    };
  }

  return { pass: true, code: 'QA035', message: `lighthouseRuns: ${runs} — sufficient for reliable median` };
}
