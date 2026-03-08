import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * MT004 — pipeline-used
 * The training script must use a sklearn Pipeline to combine preprocessing
 * and model fitting into a single atomic unit.
 *
 * Why:
 * - A Pipeline guarantees that the same preprocessing applied to training data
 *   is automatically applied to test/production data via predict().
 *   Without this guarantee, preprocessing drift between training and serving
 *   is one of the most common production ML failure modes.
 * - Pipeline enables proper cross-validation: CV folds each refit the
 *   preprocessors on their own training fold. Without Pipeline, preprocessors
 *   see all data before CV — subtle but systematic data leakage.
 * - Pipeline serialization: one joblib.dump() saves the complete inference
 *   graph. At serving time, one model.predict(raw_input) handles all preprocessing.
 *   Without Pipeline, serving code must manually replicate all preprocessing
 *   in the correct order — a drift-prone maintenance burden.
 *
 * Escape hatch: # @no-pipeline-ok: <reason> at module level for pure neural
 * network training where PyTorch DataLoaders handle preprocessing, or for
 * training scripts that output raw model weights for serving via ONNX.
 */

const PIPELINE_PATTERNS = [
  /from sklearn\.pipeline import (?:Pipeline|make_pipeline)/,
  /Pipeline\s*\(\s*(?:steps\s*=)?\s*\[/,
  /make_pipeline\s*\(/,
  /ColumnTransformer\s*\(/,
];

// Pure neural network training — pipeline not applicable
const NN_ONLY_PATTERNS = [
  /DataLoader\s*\(/,
  /model\.train\s*\(\)/,
  /optimizer\.zero_grad/,
  /loss\.backward/,
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'MT004', message: 'No Python files — pipeline check skipped', skipped: true };
  }

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  if (/@no-pipeline-ok/.test(content)) {
    return { pass: true, code: 'MT004', message: '@no-pipeline-ok — Pipeline exempted', skipped: true };
  }

  // Pure neural network training (PyTorch training loop) — Pipeline doesn't apply
  const isNNTraining = NN_ONLY_PATTERNS.filter(p => p.test(content)).length >= 2;
  if (isNNTraining) {
    return {
      pass: true, code: 'MT004',
      message: 'PyTorch training loop detected — sklearn Pipeline not applicable',
      skipped: true,
    };
  }

  const hasPipeline = PIPELINE_PATTERNS.some(p => p.test(content));
  if (!hasPipeline) {
    return {
      pass: false, code: 'MT004',
      message: 'sklearn training without Pipeline — preprocessing and model not atomic',
      detail: 'Wrap preprocessing + model in a Pipeline:\n\n' +
        '  from sklearn.pipeline import Pipeline\n' +
        '  from sklearn.preprocessing import StandardScaler\n' +
        '  from sklearn.ensemble import GradientBoostingClassifier\n\n' +
        '  pipeline = Pipeline([\n' +
        '      ("scaler",  StandardScaler()),\n' +
        '      ("model",   GradientBoostingClassifier(**cfg.model)),\n' +
        '  ])\n' +
        '  pipeline.fit(X_train, y_train)\n' +
        '  joblib.dump(pipeline, "artifacts/pipeline.joblib")\n\n' +
        'At serving time: predictions = pipeline.predict(raw_X)  # preprocessing included',
    };
  }

  return { pass: true, code: 'MT004', message: 'sklearn Pipeline used — preprocessing and model are atomic' };
}
