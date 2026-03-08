import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * EC006 — search-space-defined
 * Experiment configs must define hyperparameter search space when HPO
 * (hyperparameter optimization) is declared.
 *
 * Why:
 * - An experiment config without search space is a single point evaluation.
 *   That point was likely chosen by intuition, not systematic search.
 * - Declaring the search space creates a reproducible HPO run: anyone who
 *   runs the experiment explores the same space and can compare results.
 * - Search space bounds encode domain knowledge: n_estimators in [50, 500]
 *   is a principled choice; n_estimators in [1, 10000] wastes budget on
 *   obviously bad regions.
 * - Tools like Optuna, Ray Tune, Hyperopt, and SciKitOptimize all require
 *   a declared search space. Without it, HPO cannot be automated.
 *
 * Required when spec.hpo_enabled: true or code imports HPO libraries.
 * Search space must declare: parameter name, type, and range/choices.
 *
 * Escape hatch: add "searchSpaceExternal": true to experiment-spec.json
 * if search space is defined in a separate HPO config file.
 */

const HPO_IMPORT_PATTERNS = [
  /import optuna\b|from optuna\b/,
  /import ray\.tune\b|from ray\.tune\b/,
  /from hyperopt\b|import hyperopt\b/,
  /from skopt\b|import skopt\b/,
  /GridSearchCV\s*\(/,
  /RandomizedSearchCV\s*\(/,
  /BayesSearchCV\s*\(/,
];

const SEARCH_SPACE_PATTERNS = [
  /suggest_(?:float|int|categorical)\s*\(/,   // optuna
  /hp\.(?:uniform|choice|quniform|loguniform)/,  // hyperopt
  /tune\.(?:uniform|choice|loguniform|grid)/,    // ray tune
  /search_space\s*=\s*{/,
  /param_grid\s*=\s*{/,                         // GridSearchCV
  /param_distributions\s*=\s*{/,               // RandomizedSearchCV
];

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'experiment-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'EC006', message: 'experiment-spec.json not readable' }; }

  if (spec.searchSpaceExternal === true) {
    return { pass: true, code: 'EC006', message: 'Search space defined in external HPO config', skipped: true };
  }

  const hpoEnabled = spec.hpo_enabled === true || spec.hyperparameter_optimization === true;

  // Check for search_space in spec itself
  if (spec.search_space && typeof spec.search_space === 'object' && Object.keys(spec.search_space).length > 0) {
    return {
      pass: true, code: 'EC006',
      message: `Search space declared in spec: ${Object.keys(spec.search_space).join(', ')}`,
    };
  }

  const pyFiles = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!pyFiles.length && !hpoEnabled) {
    return { pass: true, code: 'EC006', message: 'HPO not enabled — search space check skipped', skipped: true };
  }

  const content = pyFiles.length
    ? pyFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n')
    : '';

  const hasHPO = hpoEnabled || HPO_IMPORT_PATTERNS.some(p => p.test(content));
  if (!hasHPO) {
    return { pass: true, code: 'EC006', message: 'HPO not detected — search space check not applicable', skipped: true };
  }

  const hasSearchSpace = SEARCH_SPACE_PATTERNS.some(p => p.test(content)) ||
    (spec.search_space && Object.keys(spec.search_space).length > 0);

  if (!hasSearchSpace) {
    return {
      pass: false, code: 'EC006',
      message: 'HPO enabled but no search space defined',
      detail: 'Define search space in experiment-spec.json:\n' +
        '  "search_space": {\n' +
        '    "n_estimators": {"type": "int", "low": 50, "high": 500},\n' +
        '    "learning_rate": {"type": "float", "low": 0.001, "high": 0.3, "log": true},\n' +
        '    "max_depth": {"type": "int", "low": 3, "high": 10}\n' +
        '  }\n\n' +
        'Or in Optuna objective:\n' +
        '  def objective(trial):\n' +
        '      n_est = trial.suggest_int("n_estimators", 50, 500)\n' +
        '      lr = trial.suggest_float("learning_rate", 1e-3, 0.3, log=True)',
    };
  }

  return { pass: true, code: 'EC006', message: 'Hyperparameter search space defined' };
}
