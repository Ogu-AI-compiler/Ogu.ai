import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * MM001 — baseline-distribution
 * Model monitoring configs must reference a training baseline distribution
 * that drift is measured against.
 *
 * Why:
 * - Drift detection requires a reference distribution: "what did the data
 *   look like when the model was trained?" Without this baseline, you cannot
 *   define what "drift" means — drift is deviation from training distribution.
 * - The baseline must be captured AT training time and stored immutably.
 *   Using "recent production data" as baseline defeats the purpose —
 *   if the data has already drifted, the drifted data becomes the new baseline.
 * - The baseline distribution enables automatic threshold calculation:
 *   PSI > 0.2 is "significant drift," KS p < 0.05 is "significant drift."
 *   These thresholds only make sense relative to a fixed baseline.
 *
 * Required: monitoring-config.json must declare baseline_distribution
 * pointing to a stored artifact (parquet, JSON stats, or path to training data).
 *
 * Escape hatch: add "baselineComputedOnline": true if the system dynamically
 * computes the baseline from a rolling window (valid for continuously drifting
 * environments where a fixed baseline is inappropriate).
 */

export async function run({ dir }) {
  let config;
  try { config = JSON.parse(readFileSync(join(dir, 'monitoring-config.json'), 'utf8')); }
  catch { return { pass: false, code: 'MM001', message: 'monitoring-config.json not readable' }; }

  if (config.baselineComputedOnline === true) {
    return { pass: true, code: 'MM001', message: 'Baseline computed dynamically (rolling window)', skipped: true };
  }

  const baseline = config.baseline_distribution;
  if (!baseline) {
    return {
      pass: false, code: 'MM001',
      message: 'No baseline_distribution declared in monitoring-config.json',
      detail: 'Add to monitoring-config.json:\n' +
        '  "baseline_distribution": {\n' +
        '    "path": "artifacts/training_baseline_stats.parquet",\n' +
        '    "created_at": "2024-01-15",\n' +
        '    "model_version": "v2.1.0",\n' +
        '    "n_samples": 50000\n' +
        '  }\n\n' +
        'Generate baseline at training time:\n' +
        '  # Capture training distribution statistics\n' +
        '  baseline_stats = {\n' +
        '      col: {"mean": X_train[col].mean(), "std": X_train[col].std(),\n' +
        '            "p25": X_train[col].quantile(0.25), "p75": X_train[col].quantile(0.75)}\n' +
        '      for col in X_train.columns\n' +
        '  }\n' +
        '  X_train.to_parquet("artifacts/training_baseline.parquet")',
    };
  }

  if (typeof baseline !== 'object') {
    return {
      pass: false, code: 'MM001',
      message: 'baseline_distribution must be an object with path and metadata',
      detail: '  "baseline_distribution": {\n    "path": "...",\n    "model_version": "...",\n    "n_samples": ...\n  }',
    };
  }

  if (!baseline.path) {
    return {
      pass: false, code: 'MM001',
      message: 'baseline_distribution.path not specified',
      detail: 'Add "path" pointing to the stored training distribution artifact.',
    };
  }

  return {
    pass: true, code: 'MM001',
    message: `Baseline distribution declared: ${baseline.path}${baseline.model_version ? ` (v${baseline.model_version})` : ''}`,
  };
}
