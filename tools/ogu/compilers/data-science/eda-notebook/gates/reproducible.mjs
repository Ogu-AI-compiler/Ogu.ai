import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * EN007 — reproducible
 * EDA notebooks must set random seeds and import pinning to ensure
 * all analysis results are reproducible.
 *
 * Why:
 * - EDA notebooks are often shared, re-run during peer review, and cited
 *   in reports. If plots change on each run, peer reviewers see different
 *   results and conclusions cannot be validated.
 * - Sampling (df.sample()), random downsampling for large datasets,
 *   t-SNE/UMAP dimensionality reduction, and cluster analysis all use
 *   randomness. Without a seed, these differ on each run.
 * - A reproducible notebook also serves as a regression test: if you re-run
 *   it after a data update and results differ significantly, the data changed
 *   in a meaningful way — an important signal.
 * - Jupyter notebooks are particularly susceptible to reproducibility issues
 *   due to cell execution order. The seed should be set at the TOP of the
 *   notebook, not buried in a cell.
 *
 * Escape hatch: add "noSeedNeeded": true to eda-spec.json for fully
 * deterministic analyses using only aggregations (no sampling/clustering).
 */

const SEED_PATTERNS = [
  /np\.random\.seed\s*\(/,
  /random\.seed\s*\(/,
  /torch\.manual_seed\s*\(/,
  /RANDOM_STATE\s*=\s*\d+/,
  /SEED\s*=\s*\d+/,
];

// Patterns that indicate stochastic operations requiring seeding
const STOCHASTIC_OPS = [
  /\.sample\s*\(/,
  /TSNE\s*\(|umap\.UMAP\s*\(/,
  /KMeans\s*\(/,
  /shuffle\s*=\s*True/,
  /sklearn\.utils\.shuffle\s*\(/,
];

function extractCode(dir) {
  const parts = [];
  for (const file of readdirSync(dir)) {
    if (file.endsWith('.ipynb')) {
      try {
        const nb = JSON.parse(readFileSync(join(dir, file), 'utf8'));
        for (const cell of nb.cells ?? []) parts.push((cell.source ?? []).join(''));
      } catch { /* skip */ }
    } else if (file.endsWith('.py')) {
      parts.push(readFileSync(join(dir, file), 'utf8'));
    }
  }
  return parts.join('\n');
}

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'eda-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'EN007', message: 'eda-spec.json not readable' }; }

  if (spec.noSeedNeeded === true) {
    return { pass: true, code: 'EN007', message: 'noSeedNeeded: true — fully deterministic analysis', skipped: true };
  }

  const content = extractCode(dir);
  if (!content.trim()) {
    return { pass: true, code: 'EN007', message: 'No code files — reproducibility check skipped', skipped: true };
  }

  const hasStochasticOps = STOCHASTIC_OPS.some(p => p.test(content));
  if (!hasStochasticOps) {
    // No stochastic operations — seed not required
    return { pass: true, code: 'EN007', message: 'No stochastic operations detected — seed not required' };
  }

  const hasSeed = SEED_PATTERNS.some(p => p.test(content));
  if (!hasSeed) {
    const detected = STOCHASTIC_OPS
      .filter(p => p.test(content))
      .map(p => p.source.replace(/\\s\*/g, ' ').replace(/\\/g, ''))
      .slice(0, 3);

    return {
      pass: false, code: 'EN007',
      message: 'Stochastic operations without random seed — results not reproducible',
      detail: `Detected stochastic operations: ${detected.join(', ')}\n\n` +
        'Add at the top of the notebook (first cell):\n' +
        '  import random\n' +
        '  import numpy as np\n' +
        '  RANDOM_STATE = 42\n' +
        '  random.seed(RANDOM_STATE)\n' +
        '  np.random.seed(RANDOM_STATE)\n\n' +
        'Pass to operations:\n' +
        '  df.sample(n=1000, random_state=RANDOM_STATE)\n' +
        '  KMeans(n_clusters=5, random_state=RANDOM_STATE)',
    };
  }

  return { pass: true, code: 'EN007', message: 'Random seed set — stochastic operations are reproducible' };
}
