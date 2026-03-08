import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * SA007 — latency-contract
 * Serving APIs must declare and enforce latency SLOs (Service Level Objectives).
 *
 * Why:
 * - ML models have unpredictable latency: feature computation time varies,
 *   model complexity varies, and infrastructure load varies. Without an
 *   explicit SLO, latency requirements are implicit and untested.
 * - A model that takes 500ms per request is unacceptable for a real-time
 *   fraud detection system but fine for batch recommendations.
 *   The SLO makes this requirement explicit and machine-verifiable.
 * - Declared SLOs enable load testing with realistic targets, alerting
 *   on p95/p99 latency breaches, and capacity planning.
 * - Without a latency contract, there's no way to detect model degradation
 *   due to feature computation drift, infrastructure changes, or model updates.
 *
 * Required: spec.latency_slo_ms (maximum acceptable latency in milliseconds).
 * Optional: spec.latency_percentile (p50/p95/p99, defaults to p99).
 *
 * The gate verifies spec declaration. Actual measurement is done by
 * performance tests — this gate ensures the contract is documented.
 *
 * Escape hatch: add "noLatencySLO": true to serving-spec.json with
 * a "latency_slo_note" if the model is used in batch-only pipelines.
 */

export async function run({ dir }) {
  const specPath = join(dir, 'serving-spec.json');

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'SA007', message: 'serving-spec.json not readable' }; }

  if (spec.noLatencySLO === true) {
    const note = spec.latency_slo_note ? ` — ${spec.latency_slo_note}` : '';
    return { pass: true, code: 'SA007', message: `Latency SLO not required${note}`, skipped: true };
  }

  if (!spec.latency_slo_ms) {
    return {
      pass: false, code: 'SA007',
      message: 'No latency SLO declared in serving-spec.json',
      detail: 'Add to serving-spec.json:\n' +
        '  "latency_slo_ms": 100,\n' +
        '  "latency_percentile": "p99"\n\n' +
        'Or for batch-only APIs:\n' +
        '  "noLatencySLO": true,\n' +
        '  "latency_slo_note": "Batch pipeline — latency not applicable"',
    };
  }

  const slo         = spec.latency_slo_ms;
  const percentile  = spec.latency_percentile ?? 'p99';

  if (typeof slo !== 'number' || slo <= 0) {
    return {
      pass: false, code: 'SA007',
      message: `latency_slo_ms must be a positive number, got: ${JSON.stringify(slo)}`,
    };
  }

  // Sanity check: flag suspiciously low or high SLOs
  if (slo < 1) {
    return {
      pass: false, code: 'SA007',
      message: `latency_slo_ms=${slo} is < 1ms — likely a misconfiguration`,
      detail: 'Typical ML serving SLOs: real-time: 50-200ms, near-real-time: 500-2000ms',
    };
  }

  return {
    pass: true, code: 'SA007',
    message: `Latency SLO declared: ${percentile} ≤ ${slo}ms`,
  };
}
