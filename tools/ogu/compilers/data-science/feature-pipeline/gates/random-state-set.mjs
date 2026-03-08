import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * FP004 — random-state-set
 * Feature pipeline transformers with stochastic behavior must declare
 * a fixed random_state for reproducibility.
 *
 * Why:
 * - Certain transformers use randomness: KNNImputer (neighbors vary by seed
 *   when there are ties), VarianceThreshold (deterministic), PCA (SVD solver
 *   may vary), and custom transformers with random initialization.
 * - If a transformer's output changes between runs (even slightly), the
 *   downstream model receives different features and produces different
 *   predictions — making reproducibility impossible to achieve at the
 *   model level alone.
 * - The Pipeline's random_state is NOT propagated to all components.
 *   Each transformer must have random_state set explicitly.
 * - This is especially important for: IterativeImputer (uses BayesianRidge
 *   with random initialization), cluster-based feature generators
 *   (KMeans features), and embedding-based features (UMAP, t-SNE).
 *
 * Escape hatch: # @no-random-state-ok: <reason> for transformers that are
 * deterministic by design (StandardScaler, SimpleImputer) or where
 * random_state is set globally via np.random.seed().
 */

// Transformers with stochastic behavior that need random_state
const STOCHASTIC_TRANSFORMERS = [
  'IterativeImputer',
  'KNNImputer',       // may vary in tie-breaking
  'UMAP',
  'TSNE',
  'KMeans',
  'GaussianRandomProjection',
  'SparseRandomProjection',
  'HashingVectorizer', // hash function is deterministic but test thoroughly
];

const STOCHASTIC_RE = new RegExp(`\\b(${STOCHASTIC_TRANSFORMERS.join('|')})\\s*\\(`);

// Pattern: transformer call WITHOUT random_state parameter
function lacksRandomState(line) {
  // Check if the opening paren is followed by a closing paren or other params
  // that don't include random_state
  const match = STOCHASTIC_RE.exec(line);
  if (!match) return false;

  // If random_state is on the same line, it's fine
  if (/random_state\s*=/.test(line)) return false;

  // If line ends with just opening paren, check next lines (multi-line)
  return true;
}

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'FP004', message: 'No Python files — random state check skipped', skipped: true };
  }

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  if (/@no-random-state-ok/.test(content)) {
    return { pass: true, code: 'FP004', message: '@no-random-state-ok — random state handled globally', skipped: true };
  }

  // Find stochastic transformer usages
  const violations = [];

  for (const file of files) {
    const lines = readFileSync(join(dir, file), 'utf8').split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('#')) continue;
      if (!STOCHASTIC_RE.test(line)) continue;
      if (/random_state\s*=/.test(line)) continue;

      // Check next few lines for random_state in multi-line constructor
      const context = lines.slice(i, i + 5).join('\n');
      if (/random_state\s*=/.test(context)) continue;

      const transformer = (STOCHASTIC_RE.exec(line) ?? [])[1] ?? 'transformer';
      violations.push(`${file}:${i + 1} — ${transformer}() without random_state: ${line.trim().slice(0, 60)}`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'FP004',
      message: `${violations.length} stochastic transformer(s) without random_state`,
      detail: violations.slice(0, 5).join('\n') +
        '\n\nAdd random_state to stochastic transformers:\n' +
        '  IterativeImputer(random_state=42)\n' +
        '  KMeans(n_clusters=5, random_state=42)\n' +
        '  UMAP(n_components=2, random_state=42)',
    };
  }

  return { pass: true, code: 'FP004', message: 'All stochastic transformers have random_state set' };
}
