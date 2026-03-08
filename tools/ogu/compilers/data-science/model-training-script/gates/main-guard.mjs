import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * MT002 — main-guard
 * Training scripts must wrap top-level execution in if __name__ == "__main__"
 * to prevent side effects when the module is imported.
 *
 * Why:
 * - Without the main guard, importing the training module (for testing, for
 *   accessing constants, for type checking) triggers the full training run.
 *   This breaks unit tests, import-time analysis, and makes the module
 *   unusable as a library.
 * - Orchestrators and pipeline frameworks (Airflow, Prefect, Kubeflow)
 *   sometimes import training modules to inspect parameters or metadata.
 *   A missing main guard causes unintended training runs in unexpected contexts.
 * - The main guard is also the canonical place to set up argument parsing,
 *   logging configuration, and seed setting — all of which should happen
 *   only when the script is the entry point.
 *
 * Acceptable structure:
 *   def train(cfg): ...     ← importable function
 *   if __name__ == "__main__":
 *       cfg = parse_args()
 *       train(cfg)
 *
 * Escape hatch: # @no-main-guard-ok: <reason> for Jupyter-converted scripts
 * or scripts designed exclusively for subprocess execution.
 */

const MAIN_GUARD_RE = /if\s+__name__\s*==\s*['"]__main__['"]/;

// Patterns that indicate top-level execution (training happening at import time)
const TOP_LEVEL_MODEL_FIT = /^(?:model|pipeline|clf|reg|estimator)\s*\.\s*fit\s*\(/m;
const TOP_LEVEL_TRAIN_CALL = /^train\s*\(|^run_training\s*\(|^main\s*\(\)/m;

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'MT002', message: 'No Python files — main guard check skipped', skipped: true };
  }

  const violations = [];

  for (const file of files) {
    const text = readFileSync(join(dir, file), 'utf8');

    if (/@no-main-guard-ok/.test(text)) continue;

    const hasMainGuard = MAIN_GUARD_RE.test(text);
    if (hasMainGuard) continue;

    // Check if there's training execution at module top level
    const hasTopLevelFit  = TOP_LEVEL_MODEL_FIT.test(text);
    const hasTopLevelCall = TOP_LEVEL_TRAIN_CALL.test(text);

    if (hasTopLevelFit || hasTopLevelCall) {
      violations.push(`${file}: top-level training code without if __name__ == "__main__"`);
    } else if (!hasMainGuard) {
      // Script has no main guard at all — flag as warning
      violations.push(`${file}: no if __name__ == "__main__" guard`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'MT002',
      message: `${violations.length} training script(s) missing main guard`,
      detail: violations.join('\n') +
        '\n\nAdd main guard:\n' +
        '  def train(cfg):\n' +
        '      # ... training logic ...\n' +
        '      pipeline.fit(X_train, y_train)\n' +
        '      joblib.dump(pipeline, cfg.output_path)\n\n' +
        '  if __name__ == "__main__":\n' +
        '      import argparse\n' +
        '      parser = argparse.ArgumentParser()\n' +
        '      parser.add_argument("--config", required=True)\n' +
        '      args = parser.parse_args()\n' +
        '      train(load_config(args.config))',
    };
  }

  return { pass: true, code: 'MT002', message: `if __name__ == "__main__" guard present in all training scripts` };
}
