import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * EC005 — no-hardcoded-hyperparams
 * Hyperparameters must be loaded from config files, not hardcoded in Python.
 *
 * Why:
 * - Hardcoded hyperparameters cannot be swept by HPO tools (Optuna, Ray Tune,
 *   Hyperopt) without code changes. This means each experiment requires a code
 *   change, making experiments hard to reproduce and review.
 * - When hyperparameters are in code, experiment metadata (what params were
 *   used?) is tied to git history. When they're in config files, they're tracked
 *   automatically by experiment trackers (MLflow, W&B) as run parameters.
 * - The pattern causes merge conflicts: if two researchers are experimenting
 *   with different values of learning_rate, they create code conflicts instead
 *   of just having separate config files.
 *
 * Acceptable: config loading followed by parameterization.
 * Not acceptable: model = XGBoost(n_estimators=300, learning_rate=0.05)
 *
 * Escape hatch: # @hardcoded-ok: <reason> on the line.
 */

const CONFIG_LOAD_PATTERNS = [
  /yaml\.safe_load/,
  /json\.load\s*\(/,
  /OmegaConf\.load/,
  /DictConfig/,
  /hydra\.main/,
  /argparse\.ArgumentParser/,
  /click\.option/,
  /config\s*=\s*\w+\.load/,
];

// Hyperparams that are commonly hardcoded in models
const HARDCODED_PARAM_RE = /\b(?:n_estimators|max_depth|learning_rate|lr|epochs|num_epochs|batch_size|hidden_(?:size|dim)|dropout|alpha|C\s*=\s*\d|gamma|n_neighbors|max_iter|min_samples|subsample)\s*=\s*\d/;

export async function run({ dir }) {
  const pyFiles = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!pyFiles.length) {
    return { pass: true, code: 'EC005', message: 'No Python files — hardcode check skipped', skipped: true };
  }

  const violations = [];
  let hasConfigLoad = false;

  for (const file of pyFiles) {
    const text  = readFileSync(join(dir, file), 'utf8');
    const lines = text.split('\n');

    if (CONFIG_LOAD_PATTERNS.some(p => p.test(text))) hasConfigLoad = true;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) continue;
      if (/@hardcoded-ok/.test(line) || (i > 0 && /@hardcoded-ok/.test(lines[i - 1]))) continue;

      if (HARDCODED_PARAM_RE.test(line)) {
        // If there's a config load in the file, this might be a default value
        // in a function signature — that's acceptable
        const inDefaultArg = /def\s+\w+\s*\(.*=/.test(line);
        if (!inDefaultArg || !hasConfigLoad) {
          violations.push(`${file}:${i + 1} — ${trimmed.slice(0, 80)}`);
        }
      }
    }
  }

  if (violations.length && !hasConfigLoad) {
    return {
      pass: false, code: 'EC005',
      message: `${violations.length} hardcoded hyperparameter(s) — no config loading found`,
      detail: violations.slice(0, 5).join('\n') +
        '\n\nReplace with config loading:\n' +
        '  import yaml\n' +
        '  with open("config.yaml") as f:\n' +
        '      cfg = yaml.safe_load(f)\n' +
        '  model = XGBClassifier(\n' +
        '      n_estimators=cfg["model"]["n_estimators"],\n' +
        '      learning_rate=cfg["model"]["learning_rate"],\n' +
        '  )',
    };
  }

  if (violations.length) {
    return {
      pass: false, code: 'EC005',
      message: `${violations.length} hardcoded hyperparameter(s) despite config loading`,
      detail: violations.slice(0, 5).join('\n') +
        '\n\nConfig loading detected but some params still hardcoded. Add # @hardcoded-ok: <reason> for intentional defaults.',
    };
  }

  return {
    pass: true, code: 'EC005',
    message: hasConfigLoad ? 'Hyperparameters loaded from config' : 'No hardcoded hyperparameters detected',
  };
}
