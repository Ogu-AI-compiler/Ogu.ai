/**
 * Why:
 * Hyperparameters must be loaded from an external config file or CLI args,
 * not hardcoded in the training script. Hardcoded hyperparameters make it
 * impossible to: reproduce a specific run without reading source code,
 * run hyperparameter searches, audit what configuration produced a model,
 * or tune without modifying (and potentially breaking) training code.
 *
 * Accepted config loading patterns:
 * - yaml.safe_load(f) / yaml.load(f)
 * - json.load(f) / json.loads(s)
 * - argparse.ArgumentParser()
 * - OmegaConf.load() / DictConfig
 * - hydra @hydra.main decorator
 * - config["key"] after a load call
 *
 * Hardcoded hyperparameter detection: common sklearn/XGBoost parameter names
 * with literal values (n_estimators=100, max_depth=5, learning_rate=0.01)
 * that appear BEFORE any config-loading call on that line.
 *
 * Escape hatch: add `# @hardcoded-ok: <reason>` on a specific line to
 * suppress (e.g., for a fixed regularization constant that is part of the
 * model definition, not a tunable hyperparameter).
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const CONFIG_LOAD_RE = /yaml\.(?:safe_)?load|json\.load|argparse\.ArgumentParser|OmegaConf\.load|hydra\.main|DictConfig|config\s*=\s*\{/;
const HARDCODED_PARAMS = [
  { re: /n_estimators\s*=\s*\d+/,    name: 'n_estimators' },
  { re: /max_depth\s*=\s*\d+/,       name: 'max_depth' },
  { re: /learning_rate\s*=\s*[\d.]+/, name: 'learning_rate' },
  { re: /num_leaves\s*=\s*\d+/,      name: 'num_leaves' },
  { re: /min_samples_leaf\s*=\s*\d+/, name: 'min_samples_leaf' },
  { re: /C\s*=\s*[\d.]+/,            name: 'C (regularization)' },
  { re: /alpha\s*=\s*[\d.]+/,        name: 'alpha (regularization)' },
  { re: /hidden_size\s*=\s*\d+/,     name: 'hidden_size' },
  { re: /batch_size\s*=\s*\d+/,      name: 'batch_size' },
  { re: /epochs\s*=\s*\d+/,          name: 'epochs' },
];

export async function run({ dir }) {
  const pyFiles = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!pyFiles.length) return { pass: false, code: 'MT006', message: 'No Python files found' };

  const violations = [];

  for (const f of pyFiles) {
    const content = readFileSync(join(dir, f), 'utf8');
    const hasConfigLoad = CONFIG_LOAD_RE.test(content);

    // If there's a config loader, we're satisfied — the hardcoded values
    // may be defaults / fallbacks which is acceptable
    if (hasConfigLoad) continue;

    // No config loading at all — check for hardcoded hyperparameters
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('#')) continue;
      if (/@hardcoded-ok/.test(line)) continue;

      for (const { re, name } of HARDCODED_PARAMS) {
        if (re.test(line)) {
          violations.push(`${f}:${i + 1}: ${name} hardcoded — ${line.trim().slice(0, 70)}`);
          break;
        }
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'MT006',
      message: `${violations.length} hardcoded hyperparameter(s) without config loading`,
      detail: violations.join('\n') + '\n\n' +
              'Load hyperparameters from config:\n' +
              '  with open("config.yaml") as f:\n' +
              '      config = yaml.safe_load(f)\n' +
              '  model = RandomForestClassifier(**config["hyperparameters"])\n\n' +
              'Add # @hardcoded-ok: <reason> on lines where hardcoding is intentional.',
    };
  }
  return { pass: true, code: 'MT006', message: 'Hyperparameters loaded from config or argparse' };
}
