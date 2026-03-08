import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * ST003 — sample-size-adequate
 * Statistical tests must declare minimum sample size or power analysis results.
 *
 * Why:
 * - Underpowered tests (small N) cannot reliably detect real effects.
 *   A t-test with N=20 per group has ~80% power to detect only very large
 *   effects (Cohen's d > 0.8). Small real effects are missed.
 * - Overpowered tests (very large N, e.g. N=1M) detect trivially small
 *   differences as "statistically significant" — 0.01% improvement with
 *   p=0.001 is not practically meaningful.
 * - The fix is to declare sample size requirements BEFORE data collection:
 *   power analysis (statsmodels, G*Power) determines N needed for desired
 *   power (1-β = 0.8) given expected effect size and α.
 * - Declaring minimum_sample_size in spec creates an enforceable contract:
 *   the test cannot run if data doesn't meet the declared minimum.
 *
 * Spec must declare: minimum_sample_size (per group) or power_analysis results.
 * Code should verify: len(group) >= spec.minimum_sample_size.
 *
 * Escape hatch: add "sampleSizeJustified": true to stat-test-spec.json with
 * a "sample_size_note" explaining the rationale.
 */

const POWER_ANALYSIS_PATTERNS = [
  /TTestIndPower|TTestPower|FTestAnovaPower/,
  /statsmodels.*power/i,
  /solve_power\s*\(/,
  /effect_size.*power|power.*effect_size/i,
  /minimum_detectable_effect|MDE/,
];

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'stat-test-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'ST003', message: 'stat-test-spec.json not readable' }; }

  if (spec.sampleSizeJustified === true) {
    const note = spec.sample_size_note ? ` — ${spec.sample_size_note}` : '';
    return { pass: true, code: 'ST003', message: `Sample size justified${note}`, skipped: true };
  }

  // Check if minimum_sample_size is in spec
  const hasSpecMinN = typeof spec.minimum_sample_size === 'number' && spec.minimum_sample_size > 0;
  if (hasSpecMinN) {
    // Also verify code checks it
    const files = readdirSync(dir).filter(f => f.endsWith('.py'));
    if (files.length) {
      const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
      const checksPassed = /minimum_sample_size|min_sample|assert.*len\s*\(/.test(content);
      if (!checksPassed) {
        return {
          pass: false, code: 'ST003',
          message: `minimum_sample_size=${spec.minimum_sample_size} declared but not enforced in code`,
          detail: `Add an assertion:\n  assert len(group_a) >= ${spec.minimum_sample_size}, f"Need ${spec.minimum_sample_size} samples, got {len(group_a)}"`,
        };
      }
    }
    return {
      pass: true, code: 'ST003',
      message: `Minimum sample size declared: ${spec.minimum_sample_size} per group`,
    };
  }

  // Check for power analysis in code
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return {
      pass: false, code: 'ST003',
      message: 'No minimum_sample_size in spec and no Python files to check for power analysis',
    };
  }

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const hasPowerAnalysis = POWER_ANALYSIS_PATTERNS.some(p => p.test(content));

  if (!hasPowerAnalysis) {
    return {
      pass: false, code: 'ST003',
      message: 'No sample size declaration or power analysis found',
      detail: 'Option 1 — Declare minimum in spec:\n  "minimum_sample_size": 200\n\n' +
        'Option 2 — Power analysis in code:\n' +
        '  from statsmodels.stats.power import TTestIndPower\n' +
        '  analysis = TTestIndPower()\n' +
        '  n = analysis.solve_power(effect_size=0.2, alpha=0.05, power=0.8)\n' +
        '  print(f"Required N per group: {n:.0f}")\n\n' +
        'Option 3 — Justify: "sampleSizeJustified": true, "sample_size_note": "..."',
    };
  }

  return {
    pass: true, code: 'ST003',
    message: 'Power analysis found — sample size determined analytically',
  };
}
