import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * SP006 — temporal-aware-split
 * Time-series and sequential tasks must use temporal (chronological) splits,
 * not random splits.
 *
 * Why:
 * - Random splits for time-series data cause severe future data leakage:
 *   the model trains on data from Monday and is "evaluated" on data from
 *   the previous Saturday — data that wouldn't exist at prediction time.
 * - This produces wildly optimistic metrics. A model that achieves 0.92 AUC
 *   with random split on time-series data may achieve 0.61 AUC in production.
 * - Temporal splits must respect causality: the test set must come strictly
 *   AFTER the training set in time. No data from the future should appear
 *   in training.
 * - The correct approach: sort by timestamp, take first 80% as train,
 *   last 20% as test. Or use TimeSeriesSplit for cross-validation.
 *
 * Task detection: checks spec.task OR code patterns (time series libraries,
 * datetime indices, TimeSeriesSplit usage).
 *
 * Escape hatch: # @random-split-ok: <reason> for time-series where random
 * split is justified (e.g., each sample is independent despite having timestamps).
 */

const TIME_SERIES_TASKS = new Set(['time_series', 'forecasting', 'temporal', 'sequential']);

// Code patterns indicating time-series work
const TS_CODE_PATTERNS = [
  /TimeSeriesSplit\s*\(/,
  /\.sort_values\s*\([^)]*(?:date|time|timestamp|dt)/i,
  /set_index\s*\([^)]*(?:date|time|timestamp)/i,
  /prophet|statsmodels\.tsa|arima|sarima/i,
  /DatetimeIndex/,
  /pd\.date_range/,
];

// Bad: random split on what appears to be temporal data
const RANDOM_SPLIT_RE = /train_test_split\s*\([^)]*\)/;
const TEMPORAL_SPLIT_RE = /TimeSeriesSplit|sort.*split|train.*\[:.+\]|chronolog/i;

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'split-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'SP006', message: 'split-spec.json not readable' }; }

  const task = (spec.task ?? '').toLowerCase();

  // Check if this is a time-series task
  const isTemporalTask = TIME_SERIES_TASKS.has(task);
  if (!isTemporalTask) {
    // Check code for time-series indicators
    const files = readdirSync(dir).filter(f => f.endsWith('.py'));
    if (!files.length) {
      return { pass: true, code: 'SP006', message: 'No Python files — temporal split check skipped', skipped: true };
    }
    const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
    const tsCodeIndicators = TS_CODE_PATTERNS.filter(p => p.test(content)).length;

    if (tsCodeIndicators < 2) {
      return {
        pass: true, code: 'SP006',
        message: `Task "${task || 'unspecified'}" — temporal split check not applicable`,
        skipped: true,
      };
    }
  }

  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: false, code: 'SP006', message: 'Time-series task but no Python split files found' };
  }

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  if (/@random-split-ok/.test(content)) {
    return { pass: true, code: 'SP006', message: '@random-split-ok — random split justified for this time-series', skipped: true };
  }

  const hasTemporalSplit = TEMPORAL_SPLIT_RE.test(content);
  const hasRandomSplit   = RANDOM_SPLIT_RE.test(content);

  if (hasRandomSplit && !hasTemporalSplit) {
    return {
      pass: false, code: 'SP006',
      message: 'Time-series task uses random train_test_split — future data leakage',
      detail: 'For time-series data, use chronological split:\n\n' +
        '  # Sort by time, split at 80% mark\n' +
        '  df = df.sort_values("timestamp")\n' +
        '  split_idx = int(len(df) * 0.8)\n' +
        '  train_df = df.iloc[:split_idx]\n' +
        '  test_df  = df.iloc[split_idx:]\n\n' +
        '  # For cross-validation:\n' +
        '  from sklearn.model_selection import TimeSeriesSplit\n' +
        '  tscv = TimeSeriesSplit(n_splits=5)\n' +
        '  for train_idx, val_idx in tscv.split(X): ...',
    };
  }

  if (!hasTemporalSplit) {
    return {
      pass: false, code: 'SP006',
      message: 'Time-series task but no temporal split pattern found',
      detail: 'Use TimeSeriesSplit or chronological indexing for time-series data.',
    };
  }

  return { pass: true, code: 'SP006', message: 'Temporal (chronological) split used for time-series task' };
}
