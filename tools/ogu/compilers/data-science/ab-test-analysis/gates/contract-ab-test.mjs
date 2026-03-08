import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * AB009 — contract-ab-test
 * Verifies that A/B test analyses satisfy the A/B testing contract:
 * hypothesis declared, alpha set, statistical test run, effect size reported,
 * and control group explicitly defined.
 *
 * Why:
 * - hypothesis and alpha must be declared in the spec BEFORE seeing results.
 *   Post-hoc hypothesis formation (HARKing) is the primary mechanism of
 *   false discoveries in A/B testing. The contract gate enforces pre-registration.
 * - Statistical test code must exist: a report with conclusions but no test
 *   computation is not a statistical analysis — it is an assertion.
 * - Effect size is required alongside the test result: p < 0.05 with
 *   N=10M can detect a 0.001% lift that is not worth shipping. Effect size
 *   quantifies practical significance alongside statistical significance.
 * - Explicit control group definition prevents ambiguity in multi-variant tests
 *   where the "baseline" may be unclear without explicit declaration.
 *
 * Escape hatch: none — these are non-negotiable for production A/B tests.
 */

const RULES = [
  {
    id: 'has-hypothesis',
    description: 'hypothesis is defined in spec',
    test: (spec, _content) => !!(spec && spec.hypothesis && spec.hypothesis.length >= 20)
  },
  {
    id: 'has-alpha',
    description: 'alpha significance level defined in spec',
    test: (spec, _content) => !!(spec && typeof spec.alpha === 'number' && spec.alpha > 0 && spec.alpha < 1)
  },
  {
    id: 'has-statistical-test',
    description: 'Statistical test computed in code',
    test: (_spec, content) => /ttest_ind|mannwhitneyu|chi2_contingency|proportions_ztest|ztest/i.test(content)
  },
  {
    id: 'has-effect-size',
    description: 'Effect size reported',
    test: (_spec, content) => /effect_size|cohen|lift|relative.*change|mean_diff|odds_ratio/i.test(content)
  },
  {
    id: 'has-control-group',
    description: 'Control group explicitly defined',
    test: (spec, content) => {
      if (spec && spec.control_variant) return true;
      return /control|baseline/.test(content);
    }
  },
];

export async function run({ dir }) {
  const specPath = join(dir, 'ab-test-spec.json');
  let spec = null;
  if (existsSync(specPath)) {
    try { spec = JSON.parse(readFileSync(specPath, 'utf8')); } catch {}
  }

  const pyFiles = readdirSync(dir).filter(f => f.endsWith('.py') || f.endsWith('.ipynb'));
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

  const violations = RULES.filter(r => !r.test(spec, content));

  if (violations.length) {
    return {
      pass: false, code: 'AB009',
      message: `Contract violations: ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n')
    };
  }

  return { pass: true, code: 'AB009', message: 'All A/B test contract rules passed' };
}
