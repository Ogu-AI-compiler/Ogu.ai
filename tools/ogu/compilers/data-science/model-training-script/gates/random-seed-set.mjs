import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * MT005 — random-seed-set
 * Training scripts must set random seeds for all sources of randomness.
 *
 * Why:
 * - Modern ML uses randomness from multiple sources: NumPy, Python's random,
 *   PyTorch, TensorFlow, CUDA, and sklearn. Seeding only one is insufficient.
 * - The most common mistake: setting np.random.seed() but forgetting
 *   torch.manual_seed() — training produces different results each run.
 * - Without reproducible training:
 *   - Two researchers get different results from "the same" experiment
 *   - Debugging intermittent failures is nearly impossible
 *   - Model selection (pick the best of N runs) is influenced by luck
 * - For GPU training: torch.backends.cudnn.deterministic = True is also
 *   needed because cuDNN has non-deterministic algorithms by default.
 *
 * Framework-specific seeds required:
 * - numpy: np.random.seed(N)
 * - Python: random.seed(N)
 * - PyTorch: torch.manual_seed(N) + torch.cuda.manual_seed_all(N)
 * - TensorFlow: tf.random.set_seed(N)
 * - sklearn: passed via random_state=N parameter
 *
 * Escape hatch: # @no-seed-ok: <reason> at module level (e.g., intentional
 * stochastic ensemble training where variance across seeds is desired).
 */

// Detect framework imports to know which seeds are required
const PYTORCH_IMPORT     = /import torch\b|from torch\b/;
const TF_IMPORT          = /import tensorflow\b|from tensorflow\b/;
const SKLEARN_IMPORT     = /from sklearn\b|import sklearn\b/;

// Seed setting patterns
const NP_SEED_RE      = /np\.random\.seed\s*\(|numpy\.random\.seed\s*\(/;
const PY_SEED_RE      = /(?:^|\b)random\.seed\s*\(/;
const TORCH_SEED_RE   = /torch\.manual_seed\s*\(/;
const TF_SEED_RE      = /tf\.random\.set_seed\s*\(|tensorflow\.random\.set_seed\s*\(/;

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'MT005', message: 'No Python files — seed check skipped', skipped: true };
  }

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  if (/@no-seed-ok/.test(content)) {
    return { pass: true, code: 'MT005', message: '@no-seed-ok — random seed intentionally omitted', skipped: true };
  }

  const missing = [];

  // NumPy is almost always used in ML scripts
  const usesNumpy = /import numpy\b|from numpy\b/.test(content);
  if (usesNumpy && !NP_SEED_RE.test(content)) {
    missing.push('np.random.seed(N) — NumPy randomness unseeded');
  }

  // Python random
  const usesPyRandom = /^import random\b/m.test(content);
  if (usesPyRandom && !PY_SEED_RE.test(content)) {
    missing.push('random.seed(N) — Python random module unseeded');
  }

  // PyTorch
  if (PYTORCH_IMPORT.test(content) && !TORCH_SEED_RE.test(content)) {
    missing.push('torch.manual_seed(N) — PyTorch randomness unseeded');
  }

  // TensorFlow
  if (TF_IMPORT.test(content) && !TF_SEED_RE.test(content)) {
    missing.push('tf.random.set_seed(N) — TensorFlow randomness unseeded');
  }

  if (missing.length) {
    return {
      pass: false, code: 'MT005',
      message: `${missing.length} unseeded random source(s)`,
      detail: missing.map(m => `  • ${m}`).join('\n') +
        '\n\nAdd a seed utility:\n' +
        '  def set_seeds(seed: int = 42):\n' +
        '      import random, numpy as np\n' +
        '      random.seed(seed)\n' +
        '      np.random.seed(seed)\n' +
        '      try:\n' +
        '          import torch\n' +
        '          torch.manual_seed(seed)\n' +
        '          torch.cuda.manual_seed_all(seed)\n' +
        '      except ImportError: pass\n' +
        '  set_seeds(cfg.random_seed)',
    };
  }

  return { pass: true, code: 'MT005', message: 'Random seeds set for all detected frameworks' };
}
