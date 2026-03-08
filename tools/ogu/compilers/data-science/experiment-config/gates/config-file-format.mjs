import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * EC002 — config-file-format
 * Experiments must be configured via external config files (YAML/JSON),
 * not through inline Python code only.
 *
 * Why:
 * - Config-as-code (inline Python) requires code changes for every experiment.
 *   This means: git commits for every hyperparameter change, code review for
 *   trivial value changes, and no way to launch experiments without modifying
 *   source code.
 * - External config files enable:
 *   - Experiment sweeps: generate 50 config variants programmatically
 *   - Reproducibility: each run's config is a separate file, git-tracked
 *   - Non-developer access: data scientists can tune configs without touching code
 *   - CI/CD integration: automated experiment runs with different configs
 * - YAML is preferred over JSON for config files: supports comments (for
 *   documenting hyperparameter choices) and is more human-readable.
 * - Hydra (by Facebook) and OmegaConf are the standard config management
 *   frameworks for ML experiments — both require YAML config files.
 *
 * Accepted config locations: config.yaml, params.yaml, conf/config.yaml,
 * hydra/config.yaml, config.json, params.json.
 *
 * Escape hatch: add "configInCode": true to experiment-spec.json for
 * experiments where config is intentionally inline (e.g., simple demos,
 * educational notebooks).
 */

const CONFIG_CANDIDATES = [
  'config.yaml', 'config.yml',
  'params.yaml', 'params.yml',
  'config.json', 'params.json',
  'hydra/config.yaml',
  'conf/config.yaml', 'conf/base/config.yaml',
  'configs/config.yaml',
  'settings.yaml', 'settings.yml',
];

export async function run({ dir, projectRoot }) {
  let spec = {};
  try { spec = JSON.parse(readFileSync(join(dir, 'experiment-spec.json'), 'utf8')); }
  catch { /* spec optional */ }

  if (spec.configInCode === true) {
    return { pass: true, code: 'EC002', message: 'configInCode: true — inline config accepted for this experiment', skipped: true };
  }

  const root = projectRoot || dir;
  const found = CONFIG_CANDIDATES.find(f =>
    existsSync(join(dir, f)) || existsSync(join(root, f))
  );

  if (!found) {
    return {
      pass: false, code: 'EC002',
      message: 'No experiment config file found',
      detail: 'Create config.yaml:\n\n' +
        '  model:\n' +
        '    algorithm: XGBClassifier\n' +
        '    n_estimators: 200    # number of trees [50-500]\n' +
        '    max_depth: 6         # tree depth [3-10]\n' +
        '    learning_rate: 0.05  # step size [0.001-0.3]\n' +
        '    random_state: 42     # reproducibility seed\n\n' +
        '  training:\n' +
        '    test_size: 0.2\n' +
        '    cv_folds: 5\n\n' +
        '  paths:\n' +
        '    input_data: "data/processed/features.parquet"\n' +
        '    output_model: "artifacts/model.joblib"',
    };
  }

  return { pass: true, code: 'EC002', message: `Config file found: ${found}` };
}
