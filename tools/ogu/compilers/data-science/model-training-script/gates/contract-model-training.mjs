import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * MT010 — contract-model-training
 * Verifies that training scripts satisfy the training contract:
 * random seed, experiment tracking, model serialization, and type hints.
 *
 * Why:
 * - Random seed is the minimum reproducibility guarantee: without it, two runs
 *   with identical code and config produce different models with different metrics.
 * - Experiment tracking is required for auditability: each training run must
 *   be logged to MLflow, W&B, or similar so that any production model can be
 *   traced back to its exact training configuration and data version.
 * - Model serialization: a training script that does not save the model is
 *   an expensive computation that produces no durable artifact.
 * - Type hints on data-processing functions enable static analysis tooling
 *   (mypy, pyright) to catch shape and type mismatches before runtime.
 *
 * Escape hatch: none — these are non-negotiable for production training scripts.
 */

const RULES = [
  {
    id: 'random-seed',
    description: 'Random seed explicitly set (numpy, torch, sklearn, or tensorflow)',
    test: c => /random\.seed\s*\(|np\.random\.seed\s*\(|torch\.manual_seed\s*\(|random_state\s*=/.test(c),
  },
  {
    id: 'experiment-tracking',
    description: 'MLflow, W&B, Neptune, or DVCLive tracking present',
    test: c => /mlflow\.|wandb\.|neptune\.|dvclive|comet_ml/.test(c),
  },
  {
    id: 'model-serialized',
    description: 'Model saved to disk or registry (joblib, pickle, torch.save, mlflow.log_model)',
    test: c => /joblib\.dump|pickle\.dump|mlflow\.\w+\.log_model|torch\.save|model\.save|save_pretrained/.test(c),
  },
  {
    id: 'type-hints',
    description: 'Functions have type annotations (return type or parameter types)',
    test: c => /def \w+\s*\([^)]*->\s*/.test(c) || /def \w+\s*\([^)]*:\s*(?:pd\.|np\.|DataFrame|ndarray)/.test(c),
  },
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) return { pass: false, code: 'MT010', message: 'No Python files found' };

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = RULES.filter(r => !r.test(content));

  if (violations.length) {
    return {
      pass: false, code: 'MT010',
      message: `Contract violations: ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n'),
    };
  }

  return { pass: true, code: 'MT010', message: 'All model training contract rules passed' };
}
