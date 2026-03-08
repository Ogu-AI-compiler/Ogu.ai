import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * AB003 — sample-size-pre-calculated
 * A/B tests must pre-calculate the required sample size using power analysis
 * before data collection begins.
 *
 * Why:
 * - "We'll stop when we see significance" (optional stopping) is one of
 *   the most common A/B test errors. It inflates type I error dramatically:
 *   checking continuously at α=0.05 eventually yields a false positive.
 * - Pre-calculated sample size commits to a fixed stopping rule:
 *   "we will collect N samples and analyze once." This preserves the
 *   validity of the α level.
 * - Sample size calculation also reveals whether the test is even feasible:
 *   if you need 200,000 users per group and only have 10,000 daily active
 *   users, the test will take 20 days — which may be unacceptable.
 *
 * Escape hatch: add "sequentialTesting": true to ab-test-spec.json if
 * using sequential testing methods (SPRT, mixture sequential probability)
 * that are designed for continuous monitoring without inflating error rates.
 */


export async function run({ dir }) {
  const specPath = join(dir, 'ab-test-spec.json');
  let spec = null;
  if (existsSync(specPath)) {
    try { spec = JSON.parse(readFileSync(specPath, 'utf8')); } catch {}
  }

  // Check if sample size is pre-declared in spec
  const hasSampleSizeInSpec = spec && (spec.min_sample_size || spec.required_sample_size || spec.sample_size_per_variant);

  const pyFiles = readdirSync(dir).filter(f => f.endsWith('.py') || f.endsWith('.ipynb'));
  if (!pyFiles.length) {
    if (!hasSampleSizeInSpec) {
      return {
        pass: false, code: 'AB003',
        message: 'No sample size calculation found in spec or code',
        detail: 'A/B tests must pre-calculate required sample size before running. Add min_sample_size to spec or use statsmodels TTestIndPower'
      };
    }
    return { pass: true, code: 'AB003', message: `Sample size pre-declared in spec (${spec.min_sample_size || spec.required_sample_size || spec.sample_size_per_variant})`, skipped: true };
  }

  let content = '';
  for (const f of pyFiles) {
    const raw = readFileSync(join(dir, f), 'utf8');
    if (f.endsWith('.ipynb')) {
      try {
        const nb = JSON.parse(raw);
        content += (nb.cells || []).map(c => Array.isArray(c.source) ? c.source.join('') : (c.source || '')).join('\n');
      } catch {}
    } else {
      content += raw;
    }
  }

  const hasPowerAnalysis = /TTestIndPower|NormalIndPower|GofChisquarePower|solve_power|sample_size|min_n|n_per_group|statsmodels\.stats\.power/i.test(content);
  const hasSampleSizeComment = /required\s+sample\s+size|sample\s+size\s+calculation|power\s+analysis|minimum.*sample/i.test(content);

  if (!hasPowerAnalysis && !hasSampleSizeComment && !hasSampleSizeInSpec) {
    return {
      pass: false, code: 'AB003',
      message: 'No sample size pre-calculation detected',
      detail: 'Use statsmodels.stats.power.TTestIndPower().solve_power() before running the experiment'
    };
  }

  return { pass: true, code: 'AB003', message: 'Sample size pre-calculation present' };
}
