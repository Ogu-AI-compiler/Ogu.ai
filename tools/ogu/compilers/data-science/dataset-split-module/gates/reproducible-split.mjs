import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * SP001 — reproducible-split
 * Dataset splits must use a fixed random state to produce the same train/val/test
 * sets across every run.
 *
 * Why:
 * - Without a fixed seed, each run produces different train/test partitions.
 *   Comparing two training runs becomes impossible — they may have seen different
 *   data, making metric differences uninterpretable.
 * - The most dangerous failure: a model is trained and evaluated. Results look
 *   good. The model is re-trained for production. Because the split differs,
 *   test set examples leak into training — artificially inflating performance.
 * - Reproducible splits also enable cross-team work: different researchers
 *   can reproduce results without sharing large data files.
 *
 * Required: train_test_split(random_state=N) or np.random.seed() + shuffle,
 * or GroupKFold/StratifiedKFold with fixed random_state.
 *
 * Escape hatch: # @no-seed-ok: <reason> for streaming splits where seeding
 * is inapplicable (e.g., time-ordered sequential splits with no shuffling).
 */

const SPLIT_CALLS = [
  /train_test_split\s*\(/,
  /KFold\s*\(/,
  /StratifiedKFold\s*\(/,
  /GroupKFold\s*\(/,
  /TimeSeriesSplit\s*\(/,
  /\.split\s*\(/,  // generic sklearn splitter
];

const SEEDED_SPLIT = [
  /train_test_split\s*\([^)]*random_state\s*=/,
  /KFold\s*\([^)]*random_state\s*=/,
  /StratifiedKFold\s*\([^)]*random_state\s*=/,
  /GroupKFold\s*\([^)]*random_state\s*=/,
  /np\.random\.seed\s*\(/,
  /random\.seed\s*\(/,
  /torch\.manual_seed\s*\(/,
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'SP001', message: 'No Python files — reproducible split check skipped', skipped: true };
  }

  for (const file of files) {
    const text  = readFileSync(join(dir, file), 'utf8');
    const lines = text.split('\n');

    // Escape hatch — file level
    if (/@no-seed-ok/.test(text)) continue;

    const hasSplitCall = SPLIT_CALLS.some(p => p.test(text));
    if (!hasSplitCall) continue;

    const hasSeededSplit = SEEDED_SPLIT.some(p => p.test(text));
    if (!hasSeededSplit) {
      // Find the offending split call for a helpful error
      let offendingLine = '';
      for (let i = 0; i < lines.length; i++) {
        if (SPLIT_CALLS.some(p => p.test(lines[i]))) {
          offendingLine = `${file}:${i + 1} — ${lines[i].trim().slice(0, 80)}`;
          break;
        }
      }

      return {
        pass: false, code: 'SP001',
        message: `Split without fixed random_state — results not reproducible`,
        detail: (offendingLine ? offendingLine + '\n\n' : '') +
          'Fix:\n  X_train, X_test, y_train, y_test = train_test_split(\n' +
          '      X, y, test_size=0.2, random_state=42\n  )\n\n' +
          'Or for seeded global state:\n  np.random.seed(42)\n\n' +
          'For time-ordered splits (no shuffling needed):\n  # @no-seed-ok: temporal split, no shuffling',
      };
    }
  }

  return { pass: true, code: 'SP001', message: 'All dataset splits use fixed random_state' };
}
