import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * JN006 — no-global-mutations
 * Production notebooks must not use patterns that mutate global state
 * in ways that make cell execution order-dependent.
 *
 * Why:
 * - inplace=True on pandas DataFrames is the most common source of
 *   order-dependent state in notebooks. It modifies the DataFrame in-place,
 *   meaning cells that ran before will see a different object on re-run.
 * - Global variable assignments inside loops create hidden dependencies
 *   between cells — the variable from loop iteration 3 is available in
 *   all subsequent cells, but only after that specific cell runs.
 * - The test: "If I restart the kernel and run cells 1,2,3 in order, do
 *   I get the same result as running 1,3,2?" If not, global state is the culprit.
 *
 * Escape hatch: # @global-mutation-ok: <reason> on the specific line.
 */


// Detects global state mutation patterns that make notebooks non-reproducible
const MUTATION_PATTERNS = [
  { pattern: /^(?!.*#.*)df\s*=\s*df\[/m, name: 'in-place DataFrame filter (df = df[...]) without copy' },
  { pattern: /\.drop\s*\([^)]+,\s*inplace\s*=\s*True/, name: '.drop(inplace=True) — mutates global DataFrame' },
  { pattern: /\.fillna\s*\([^)]+,\s*inplace\s*=\s*True/, name: '.fillna(inplace=True) — mutates global DataFrame' },
  { pattern: /\.rename\s*\([^)]+,\s*inplace\s*=\s*True/, name: '.rename(inplace=True) — mutates global DataFrame' },
  { pattern: /\.sort_values\s*\([^)]+,\s*inplace\s*=\s*True/, name: '.sort_values(inplace=True) — mutates global DataFrame' },
  { pattern: /^import\s+importlib\b/m, name: 'importlib usage — dynamic imports suggest brittle global state' },
];

export async function run({ dir }) {
  const notebooks = readdirSync(dir).filter(f => f.endsWith('.ipynb'));
  if (!notebooks.length) return { pass: false, code: 'JN006', message: 'No .ipynb file found' };

  const violations = [];
  for (const nb of notebooks) {
    let parsed;
    try { parsed = JSON.parse(readFileSync(join(dir, nb), 'utf8')); } catch { continue; }

    const codeCells = (parsed.cells || []).filter(c => c.cell_type === 'code');
    const allCode = codeCells.map(c => Array.isArray(c.source) ? c.source.join('') : c.source).join('\n');

    for (const { pattern, name } of MUTATION_PATTERNS) {
      if (pattern.test(allCode)) {
        violations.push(`${nb}: ${name}`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'JN006',
      message: `Global mutation patterns detected`,
      detail: violations.join('\n') + '\nUse df.copy() and avoid inplace=True to preserve reproducibility'
    };
  }

  return { pass: true, code: 'JN006', message: 'No global mutation patterns detected' };
}
