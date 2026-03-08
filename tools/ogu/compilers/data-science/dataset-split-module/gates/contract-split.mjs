import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * SP009 — contract-split
 * Verifies that dataset split code satisfies the split contract:
 * random_state set in split calls, no fit() on test data.
 *
 * Why:
 * - random_state in every split call is the minimum reproducibility requirement:
 *   without it, re-running training produces different train/test splits,
 *   making metric comparisons across runs meaningless.
 * - No fit() on test data is the single most important data leakage prevention
 *   rule. Fitting transformers on test data leaks test statistics into training,
 *   producing optimistic metrics that fail catastrophically in production.
 * - The contract gate is the final check: it runs after individual domain gates
 *   to provide a single pass/fail that covers both requirements together.
 *
 * Escape hatch: none — these are non-negotiable for all ML dataset splits.
 */

const RULES = [
  {
    id: 'random-state',
    description: 'random_state set in split calls (reproducibility requirement)',
    test: c => /random_state\s*=/.test(c),
  },
  {
    id: 'no-fit-on-test',
    description: 'No fit() or fit_transform() on X_test/x_test variables',
    test: c => !/\.fit(?:_transform)?\s*\(\s*(?:X_test|x_test)/.test(c),
  },
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) return { pass: false, code: 'SP009', message: 'No Python files found' };

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = RULES.filter(r => !r.test(content));

  if (violations.length) {
    return {
      pass: false, code: 'SP009',
      message: `Contract violations: ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n'),
    };
  }

  return { pass: true, code: 'SP009', message: 'All split contract rules passed' };
}
