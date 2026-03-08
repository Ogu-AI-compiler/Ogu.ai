import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * MT008 — model-serialized
 * Training scripts must serialize the trained model to a file using
 * an explicit, stable serialization format.
 *
 * Why:
 * - A model that exists only in memory is worthless. The artifact produced by
 *   training must be persisted and versioned to be deployable and reproducible.
 * - Serialization format matters:
 *   - joblib: fastest for sklearn, preserves sklearn API
 *   - pickle: works but has Python version dependency issues
 *   - ONNX: cross-framework, production-recommended for serving
 *   - torch.save: PyTorch-specific, full state dict
 *   - SavedModel: TensorFlow production format
 * - Training without serialization is common during exploration but must
 *   be fixed before a script is committed as production training code.
 * - The serialization path must match the model registry's expected artifact
 *   location so the registry can pick it up automatically.
 *
 * Escape hatch: # @no-serialize-ok: <reason> for distributed training scripts
 * where serialization happens in a separate aggregation step.
 */

const SERIALIZE_PATTERNS = [
  /joblib\.dump\s*\(/,
  /pickle\.dump\s*\(/,
  /model\.save\s*\(/,                   // keras/tf
  /torch\.save\s*\(/,
  /torch\.jit\.save\s*\(/,
  /\.save_pretrained\s*\(/,             // HuggingFace
  /onnx\.save\s*\(|onnxruntime/,
  /mlflow\.sklearn\.log_model/,
  /mlflow\.pytorch\.log_model/,
  /mlflow\.tensorflow\.log_model/,
  /wandb\.log_artifact/,
  /tf\.saved_model\.save\s*\(/,
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'MT008', message: 'No Python files — serialization check skipped', skipped: true };
  }

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  if (/@no-serialize-ok/.test(content)) {
    return { pass: true, code: 'MT008', message: '@no-serialize-ok — serialization handled externally', skipped: true };
  }

  const matched = SERIALIZE_PATTERNS.find(p => p.test(content));
  if (!matched) {
    return {
      pass: false, code: 'MT008',
      message: 'No model serialization found in training script',
      detail: 'Add serialization after training:\n\n' +
        '  # sklearn / gradient boosting\n' +
        '  import joblib\n' +
        '  joblib.dump(pipeline, "artifacts/model.joblib")\n\n' +
        '  # PyTorch\n' +
        '  torch.save(model.state_dict(), "artifacts/model.pt")\n\n' +
        '  # MLflow (framework-agnostic)\n' +
        '  mlflow.sklearn.log_model(model, "model")\n\n' +
        '  # ONNX (cross-platform serving)\n' +
        '  import skl2onnx; onnx_model = skl2onnx.convert_sklearn(model)\n' +
        '  with open("artifacts/model.onnx", "wb") as f: f.write(onnx_model.SerializeToString())',
    };
  }

  return { pass: true, code: 'MT008', message: 'Model serialized to artifact file' };
}
