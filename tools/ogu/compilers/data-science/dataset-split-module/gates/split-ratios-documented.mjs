import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * SP007 — split-ratios-documented
 * Dataset split ratios must be declared in the spec and verified in code.
 *
 * Why:
 * - Undocumented split ratios are implicit magic numbers: test_size=0.2 in
 *   code is invisible in the spec, and the spec's "80/10/10 split" may not
 *   match what the code actually does.
 * - Declared ratios enable automatic verification: if the dataset grows
 *   from 10K to 100K rows, the absolute size of train/test sets changes.
 *   The ratio may still be appropriate or may need adjustment.
 * - Standard ratios depend on dataset size:
 *   - Large (>100K): 90/5/5 is fine (large absolute test set)
 *   - Medium (10K-100K): 80/10/10 is standard
 *   - Small (<10K): consider k-fold CV instead of a fixed test set
 * - The validation-to-test split is often overlooked: many implementations
 *   use validation and test interchangeably, which inflates test metrics.
 *
 * Escape hatch: add "ratioJustified": true to split-spec.json for
 * cross-validation setups where there's no fixed train/test ratio.
 */

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'split-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'SP007', message: 'split-spec.json not readable' }; }

  if (spec.ratioJustified === true || spec.use_cross_validation === true) {
    return { pass: true, code: 'SP007', message: 'Cross-validation or justified ratio — fixed split not required', skipped: true };
  }

  const trainRatio = spec.train_ratio ?? spec.train_size;
  const testRatio  = spec.test_ratio  ?? spec.test_size;
  const valRatio   = spec.val_ratio   ?? spec.val_size  ?? spec.validation_ratio;

  const issues = [];

  if (trainRatio === undefined) issues.push('Missing train_ratio in spec');
  if (testRatio  === undefined) issues.push('Missing test_ratio in spec');

  if (issues.length) {
    return {
      pass: false, code: 'SP007',
      message: 'Split ratios not declared in split-spec.json',
      detail: issues.join('\n') +
        '\n\nAdd to split-spec.json:\n' +
        '  "train_ratio": 0.8,\n' +
        '  "val_ratio": 0.1,\n' +
        '  "test_ratio": 0.1\n\n' +
        'For cross-validation:\n  "use_cross_validation": true, "n_splits": 5',
    };
  }

  // Validate ratios sum to 1
  const total = (trainRatio ?? 0) + (testRatio ?? 0) + (valRatio ?? 0);
  if (Math.abs(total - 1.0) > 0.01) {
    return {
      pass: false, code: 'SP007',
      message: `Split ratios sum to ${total.toFixed(3)} — must sum to 1.0`,
      detail: `train=${trainRatio}, val=${valRatio ?? 0}, test=${testRatio}\nAdjust ratios to sum to 1.0`,
    };
  }

  // Check that code respects declared test_size
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (files.length && testRatio) {
    const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
    const codeTestSize = content.match(/test_size\s*=\s*([\d.]+)/)?.[1];
    if (codeTestSize && Math.abs(parseFloat(codeTestSize) - testRatio) > 0.01) {
      return {
        pass: false, code: 'SP007',
        message: `Spec test_ratio=${testRatio} but code uses test_size=${codeTestSize}`,
        detail: `Align code with spec:\n  train_test_split(..., test_size=${testRatio}, random_state=42)`,
      };
    }
  }

  return {
    pass: true, code: 'SP007',
    message: `Split ratios declared: train=${trainRatio}${valRatio ? `/val=${valRatio}` : ''}/test=${testRatio}`,
  };
}
