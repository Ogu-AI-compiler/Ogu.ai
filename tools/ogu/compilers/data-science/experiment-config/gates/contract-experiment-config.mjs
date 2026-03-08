import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * EC008 — contract-experiment-config
 * Verifies that the experiment configuration satisfies the contract:
 * external config file exists and reproducibility seed is set.
 *
 * Why:
 * - An experiment config without an external file (YAML/JSON) is config-in-code,
 *   which requires a git commit for every hyperparameter change and makes
 *   experiment sweeps impossible without modifying source files.
 * - A reproducibility seed in config (not hardcoded) is the minimum requirement
 *   for reproducible experiments: the seed can be varied intentionally while
 *   keeping the rest of the config identical.
 * - This contract is the final check: even if individual gate checks passed,
 *   the contract gate ensures both requirements are met simultaneously.
 *
 * Escape hatch: none — these are non-negotiable for production experiments.
 */

export async function run({ dir }) {
  const allFiles = readdirSync(dir);
  const configFiles = allFiles.filter(f =>
    f.endsWith('.yaml') || f.endsWith('.yml') ||
    (f.endsWith('.json') && f !== 'experiment-spec.json')
  );

  const content = allFiles
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml') || f.endsWith('.json') || f.endsWith('.py'))
    .map(f => readFileSync(join(dir, f), 'utf8'))
    .join('\n');

  const RULES = [
    {
      id: 'has-config-file',
      description: 'External YAML or JSON config file exists (not just experiment-spec.json)',
      test: () => configFiles.length > 0,
    },
    {
      id: 'has-seed',
      description: 'random_state or seed declared in config',
      test: () => /(?:random_state|seed|random_seed)\s*[:=]\s*\d+/.test(content),
    },
  ];

  const violations = RULES.filter(r => !r.test());

  if (violations.length) {
    return {
      pass: false, code: 'EC008',
      message: `Contract violations: ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n'),
    };
  }

  return { pass: true, code: 'EC008', message: 'All experiment config contract rules passed' };
}
