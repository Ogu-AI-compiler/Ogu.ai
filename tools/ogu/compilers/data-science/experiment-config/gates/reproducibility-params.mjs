import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * EC004 — reproducibility-params
 * Experiment configs must declare random seed, Python version, and
 * framework versions to enable full reproducibility.
 *
 * Why:
 * - Without a fixed seed, every training run produces different weights.
 *   Comparison across runs is impossible — you're comparing two different
 *   random initializations, not two different hyperparameter choices.
 * - Without framework version pinning, "the same config" produces different
 *   results after library updates. sklearn 1.2 and 1.3 produce different
 *   random forests from the same seed due to algorithm changes.
 * - Reproducibility is not optional for production ML — it's required for:
 *   - Model debugging (can you reproduce a failure?)
 *   - Regulatory compliance (can you explain a decision made 6 months ago?)
 *   - Incident response (can you roll back to the last known good model?)
 *
 * Required in config: random_seed (or seed/random_state), and either
 * a requirements file reference or an environment section with versions.
 */

const SEED_KEYS = new Set(['random_seed', 'seed', 'random_state', 'global_seed', 'numpy_seed', 'torch_seed']);

function flatKeys(obj, prefix = '') {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  return Object.entries(obj).flatMap(([k, v]) => {
    const full = prefix ? `${prefix}.${k}` : k;
    return [full, ...flatKeys(v, full)];
  });
}

export async function run({ dir }) {
  const configFiles = readdirSync(dir).filter(f =>
    (f.endsWith('.yaml') || f.endsWith('.yml') || f.endsWith('.json')) &&
    f !== 'experiment-spec.json'
  );

  if (!configFiles.length) {
    return { pass: true, code: 'EC004', message: 'No config files found — skipped', skipped: true };
  }

  const issues = [];

  for (const file of configFiles) {
    let config;
    try {
      const text = readFileSync(join(dir, file), 'utf8');
      // Simple YAML key detection without full parse — look for seed keys
      const hasSeed = SEED_KEYS.has
        ? [...SEED_KEYS].some(k => new RegExp(`\\b${k}\\s*:`).test(text))
        : false;

      // For JSON we can parse
      if (file.endsWith('.json')) {
        config = JSON.parse(text);
        const keys = flatKeys(config);
        const hasSeedKey = keys.some(k => SEED_KEYS.has(k.split('.').pop()));
        if (!hasSeedKey) {
          issues.push(`${file}: no random_seed/seed/random_state key`);
        }
        const hasVersions = keys.some(k => /version|python_version|requirements/.test(k));
        if (!hasVersions) {
          issues.push(`${file}: no framework version pinning (python_version, requirements_file, or dependencies)`);
        }
      } else {
        // YAML: regex-based check
        if (!hasSeed) {
          issues.push(`${file}: no random_seed/seed/random_state key`);
        }
        const hasVersions = /python_version|requirements|framework_version|torch_version|sklearn_version/.test(text);
        if (!hasVersions) {
          issues.push(`${file}: no framework version pinning`);
        }
      }
    } catch {
      issues.push(`${file}: not parseable`);
    }
  }

  if (issues.length) {
    return {
      pass: false, code: 'EC004',
      message: `${issues.length} reproducibility issue(s) in experiment config`,
      detail: issues.join('\n') +
        '\n\nAdd to config.yaml:\n' +
        '  random_seed: 42\n' +
        '  python_version: "3.11"\n' +
        '  requirements_file: "requirements.txt"\n\n' +
        'And in code:\n' +
        '  import random, numpy as np\n' +
        '  random.seed(cfg.random_seed)\n' +
        '  np.random.seed(cfg.random_seed)',
    };
  }

  return {
    pass: true, code: 'EC004',
    message: `Reproducibility parameters present in ${configFiles.length} config file(s)`,
  };
}
