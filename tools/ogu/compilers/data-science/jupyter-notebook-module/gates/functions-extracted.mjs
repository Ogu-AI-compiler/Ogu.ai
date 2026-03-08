import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * JN005 — functions-extracted
 * Production notebooks must not contain large blocks of duplicated logic
 * or procedural code that should be extracted to importable modules.
 *
 * Why:
 * - Notebooks are not suitable for complex logic: no unit tests, no imports
 *   from other notebooks, and copy-paste duplication across cells.
 * - When business logic lives in notebooks, it cannot be reused in pipelines,
 *   APIs, or other notebooks without copy-pasting — leading to drift.
 * - The rule of thumb: if a notebook cell is >80 lines, it should be a
 *   function in a .py module. If similar code appears in multiple cells,
 *   it should be a function.
 *
 * Escape hatch: add "largeBlocksOk": true to notebook-spec.json for
 * notebooks with intentionally long cells (e.g., visualizations, SQL queries).
 */


// Detects notebooks where repeated logic isn't extracted into functions
export async function run({ dir }) {
  const notebooks = readdirSync(dir).filter(f => f.endsWith('.ipynb'));
  if (!notebooks.length) return { pass: false, code: 'JN005', message: 'No .ipynb file found' };

  const violations = [];
  for (const nb of notebooks) {
    let parsed;
    try { parsed = JSON.parse(readFileSync(join(dir, nb), 'utf8')); } catch { continue; }

    const codeCells = (parsed.cells || []).filter(c => c.cell_type === 'code');
    const allCode = codeCells.map(c => Array.isArray(c.source) ? c.source.join('') : c.source).join('\n');

    // Count total lines of code
    const totalLines = allCode.split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).length;

    // Count function definitions
    const funcDefs = (allCode.match(/^def\s+\w+\s*\(/gm) || []).length;

    // If notebook is substantial (>80 code lines) and has zero functions, flag it
    if (totalLines > 80 && funcDefs === 0) {
      violations.push(`${nb}: ${totalLines} lines of code but no function definitions — extract reusable logic into functions`);
    }

    // Detect obvious copy-paste: same 3+ line block appearing >1 time
    const cellBodies = codeCells.map(c => Array.isArray(c.source) ? c.source.join('') : c.source);
    const seen = new Set();
    const dupes = new Set();
    for (const body of cellBodies) {
      const normalized = body.trim().replace(/\s+/g, ' ');
      if (normalized.length > 60) {
        if (seen.has(normalized)) dupes.add(normalized.substring(0, 60));
        seen.add(normalized);
      }
    }
    if (dupes.size > 0) {
      violations.push(`${nb}: ${dupes.size} code cell(s) appear to be duplicated — extract into a function`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'JN005',
      message: `Logic should be extracted into functions`,
      detail: violations.join('\n')
    };
  }

  return { pass: true, code: 'JN005', message: 'Reusable logic is extracted into functions' };
}
