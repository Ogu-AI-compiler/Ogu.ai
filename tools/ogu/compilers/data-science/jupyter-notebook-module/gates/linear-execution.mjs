import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * JN002 — linear-execution
 * Jupyter notebooks submitted as production artifacts must have been
 * executed linearly from top to bottom (monotonic execution counts).
 *
 * Why:
 * - Notebooks executed out of order produce results that depend on hidden
 *   state: variables set in cell 10 that were used in cell 3. When the
 *   notebook is re-run top-to-bottom, it fails or produces different results.
 * - Production notebooks must be reproducible: someone opening the notebook
 *   for the first time and running "Run All" must get identical results.
 * - Non-linear execution is fine during development. It becomes a problem
 *   when the notebook is committed as a deliverable.
 *
 * Escape hatch: add "nonLinearOk": true to notebook-spec.json for
 * notebooks intentionally designed for interactive use (demos, tutorials).
 */


export async function run({ dir }) {
  const notebooks = readdirSync(dir).filter(f => f.endsWith('.ipynb'));
  if (!notebooks.length) return { pass: false, code: 'JN002', message: 'No .ipynb file found' };

  const violations = [];
  for (const nb of notebooks) {
    let parsed;
    try { parsed = JSON.parse(readFileSync(join(dir, nb), 'utf8')); } catch { continue; }

    const codeCells = (parsed.cells || []).filter(c => c.cell_type === 'code');
    const execCounts = codeCells
      .map(c => c.execution_count)
      .filter(n => n !== null && n !== undefined);

    if (execCounts.length === 0) continue;

    // Check for out-of-order execution: each count should be >= previous
    let prev = 0;
    let outOfOrder = false;
    for (const count of execCounts) {
      if (typeof count === 'number' && count < prev) { outOfOrder = true; break; }
      if (typeof count === 'number') prev = count;
    }

    if (outOfOrder) {
      violations.push(`${nb}: cells executed out of order (non-linear execution_count sequence)`);
    }

    // Check for cells with execution count but skipped cells (gaps suggest re-runs)
    const numericCounts = execCounts.filter(n => typeof n === 'number');
    if (numericCounts.length > 1) {
      const max = Math.max(...numericCounts);
      const min = Math.min(...numericCounts);
      const gap = max - min + 1 - numericCounts.length;
      if (gap > numericCounts.length * 0.3) {
        violations.push(`${nb}: large gaps in execution order suggest cells were run non-linearly`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'JN002',
      message: `Non-linear execution detected`,
      detail: violations.join('\n') + '\nRun "Restart & Run All" before committing'
    };
  }

  return { pass: true, code: 'JN002', message: 'Notebook(s) have linear execution order' };
}
