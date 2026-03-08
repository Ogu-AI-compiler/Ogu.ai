import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * JN007 — reproducible
 * Production notebooks must set random seeds to ensure results are
 * reproducible across kernel restarts and re-runs.
 *
 * Why: same as EN007 (EDA reproducibility) but for production module notebooks.
 * Particularly important for notebooks that:
 * - Sample data (df.sample())
 * - Perform dimensionality reduction (t-SNE, UMAP)
 * - Train models or cross-validate
 * Without a seed, results differ between the original run and any re-run,
 * making the notebook unreliable as a documented artifact.
 *
 * Escape hatch: add "noSeedNeeded": true to notebook-spec.json for
 * fully deterministic analyses with no stochastic operations.
 */


export async function run({ dir }) {
  const notebooks = readdirSync(dir).filter(f => f.endsWith('.ipynb'));
  if (!notebooks.length) return { pass: false, code: 'JN007', message: 'No .ipynb file found' };

  const violations = [];
  for (const nb of notebooks) {
    let parsed;
    try { parsed = JSON.parse(readFileSync(join(dir, nb), 'utf8')); } catch { continue; }

    const codeCells = (parsed.cells || []).filter(c => c.cell_type === 'code');
    const allCode = codeCells.map(c => Array.isArray(c.source) ? c.source.join('') : c.source).join('\n');

    const usesNumpy = /import numpy|from numpy/.test(allCode);
    const usesRandom = /import random\b/.test(allCode);
    const usesSKLearn = /from sklearn|import sklearn/.test(allCode);
    const usesTorch = /import torch/.test(allCode);
    const usesTF = /import tensorflow/.test(allCode);

    const hasSeed = /np\.random\.seed\s*\(|numpy\.random\.seed\s*\(/.test(allCode);
    const hasPySeed = /random\.seed\s*\(/.test(allCode);
    const hasTorchSeed = /torch\.manual_seed\s*\(/.test(allCode);
    const hasTFSeed = /tf\.random\.set_seed\s*\(/.test(allCode);
    const hasRandomState = /random_state\s*=/.test(allCode);
    const hasSEED = /\bSEED\s*=\s*\d+/.test(allCode);

    if (usesNumpy && !hasSeed && !hasSEED && !hasRandomState) {
      violations.push(`${nb}: uses numpy but no np.random.seed() or SEED constant — results are not reproducible`);
    }
    if (usesRandom && !hasPySeed && !hasSEED) {
      violations.push(`${nb}: uses random module but no random.seed() — results are not reproducible`);
    }
    if (usesTorch && !hasTorchSeed) {
      violations.push(`${nb}: uses PyTorch but no torch.manual_seed() — results are not reproducible`);
    }
    if (usesTF && !hasTFSeed) {
      violations.push(`${nb}: uses TensorFlow but no tf.random.set_seed() — results are not reproducible`);
    }
    if (usesSKLearn && !hasRandomState && !hasSeed && !hasSEED) {
      violations.push(`${nb}: uses sklearn but no random_state parameter or seed — stochastic results not reproducible`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'JN007',
      message: `Reproducibility not ensured`,
      detail: violations.join('\n')
    };
  }

  return { pass: true, code: 'JN007', message: 'Notebook reproducibility seeds are set' };
}
