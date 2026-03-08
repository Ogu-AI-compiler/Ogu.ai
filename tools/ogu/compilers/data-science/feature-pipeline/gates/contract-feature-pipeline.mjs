import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * FP010 — contract-feature-pipeline
 * Verifies that feature pipelines satisfy the contract:
 * sklearn Pipeline used, no deprecated indexers, functions typed.
 *
 * Why:
 * - sklearn Pipeline is the standard abstraction for feature transformation:
 *   it guarantees fit-only-on-train, enables serialization of the entire
 *   transform chain, and prevents the most common leakage patterns.
 * - The deprecated .ix[] indexer was removed in pandas 1.0. Code using it
 *   will fail silently on upgraded environments or raise confusing errors.
 * - Type hints on functions that transform DataFrames are required for
 *   tooling support (IDEs, mypy, automated documentation) and for human
 *   reviewers to understand what shapes are expected at each stage.
 *
 * Escape hatch: none — these are non-negotiable for production feature pipelines.
 */

const RULES = [
  {
    id: 'sklearn-pipeline',
    description: 'sklearn Pipeline or ColumnTransformer used (not manual fit/transform chain)',
    test: c => /sklearn\.pipeline|make_pipeline|ColumnTransformer|Pipeline\s*\(/.test(c),
  },
  {
    id: 'no-ix-indexer',
    description: 'No deprecated .ix[] indexer (removed in pandas 1.0)',
    test: c => !/.ix\s*\[/.test(c),
  },
  {
    id: 'type-hints',
    description: 'Functions have type hints (pd.DataFrame, np.ndarray, etc.)',
    test: c => /def \w+\s*\([^)]*:\s*(?:pd\.|np\.|DataFrame|ndarray|List|Dict|Optional)/.test(c),
  },
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) return { pass: false, code: 'FP010', message: 'No Python files found' };

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = RULES.filter(r => !r.test(content));

  if (violations.length) {
    return {
      pass: false, code: 'FP010',
      message: `Contract violations: ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n'),
    };
  }

  return { pass: true, code: 'FP010', message: 'All feature pipeline contract rules passed' };
}
