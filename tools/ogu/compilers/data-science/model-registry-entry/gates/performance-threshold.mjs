import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * MR004 — performance-threshold
 * Models must meet declared performance thresholds before registry registration.
 *
 * Why:
 * - Without a minimum performance gate, any trained model can be registered
 *   and deployed — including models worse than the baseline/random predictor.
 * - Performance thresholds are the primary defense against model degradation:
 *   if data drift causes model quality to drop below threshold, registration
 *   is blocked and a human review is required.
 * - Thresholds must be declared in the spec (not checked ad-hoc) so that
 *   the same bar is applied consistently across all training runs and
 *   experiments — not adjusted retroactively to match a given model.
 *
 * Evaluation:
 * - spec declares: primary_metric (e.g., "f1_score") and performance_threshold (0.85)
 * - metadata declares: metrics.f1_score: 0.882
 * - Gate compares: actual ≥ threshold
 *
 * Escape hatch: add "bootstrapMode": true to registry-spec.json for initial
 * model registrations where no historical threshold exists yet.
 */

export async function run({ dir }) {
  const specPath = join(dir, 'registry-spec.json');
  const metaPath = join(dir, 'model-metadata.json');

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'MR004', message: 'registry-spec.json not readable' }; }

  if (spec.bootstrapMode === true) {
    return { pass: true, code: 'MR004', message: 'bootstrapMode: true — threshold check skipped for initial registration', skipped: true };
  }

  if (!spec.performance_threshold || !spec.primary_metric) {
    return {
      pass: false, code: 'MR004',
      message: 'registry-spec.json missing performance_threshold or primary_metric',
      detail: 'Add to registry-spec.json:\n  "primary_metric": "f1_score",\n  "performance_threshold": 0.85\n\nOr set "bootstrapMode": true for the first ever model registration.',
    };
  }

  if (!existsSync(metaPath)) {
    return {
      pass: false, code: 'MR004',
      message: 'model-metadata.json not found — cannot verify performance',
      detail: 'model-metadata.json must contain: { "metrics": { "f1_score": 0.882 } }',
    };
  }

  let meta;
  try { meta = JSON.parse(readFileSync(metaPath, 'utf8')); }
  catch { return { pass: false, code: 'MR004', message: 'model-metadata.json not parseable' }; }

  const metric     = spec.primary_metric;
  const threshold  = spec.performance_threshold;
  const actual     = meta.metrics?.[metric];

  if (actual === undefined || actual === null) {
    return {
      pass: false, code: 'MR004',
      message: `Metric "${metric}" not found in model-metadata.json`,
      detail: `Expected: { "metrics": { "${metric}": <value> } }`,
    };
  }

  if (typeof actual !== 'number') {
    return {
      pass: false, code: 'MR004',
      message: `Metric "${metric}" is not a number: ${JSON.stringify(actual)}`,
    };
  }

  if (actual < threshold) {
    const gap = (threshold - actual).toFixed(4);
    return {
      pass: false, code: 'MR004',
      message: `${metric}=${actual.toFixed(4)} below threshold ${threshold} (gap: ${gap})`,
      detail: `Model does not meet the minimum performance bar.\n` +
        `Required: ${metric} ≥ ${threshold}\nActual:   ${metric} = ${actual.toFixed(4)}\n\n` +
        `Options:\n` +
        `1. Improve the model to exceed threshold\n` +
        `2. Re-evaluate if threshold is appropriate for the task\n` +
        `3. Set "bootstrapMode": true if this is an initial registration with no prior bar`,
    };
  }

  return {
    pass: true, code: 'MR004',
    message: `${metric}=${actual.toFixed(4)} ≥ threshold ${threshold} ✓`,
  };
}
