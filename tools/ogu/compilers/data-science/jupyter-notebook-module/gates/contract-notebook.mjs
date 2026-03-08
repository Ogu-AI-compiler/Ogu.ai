import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * JN009 — contract-notebook
 * Verifies that Jupyter notebooks satisfy the notebook contract:
 * markdown title in first cell, linear execution order, functions extracted,
 * and no empty code cells.
 *
 * Why:
 * - A notebook without a markdown title in the first cell is not self-describing:
 *   it cannot be identified without reading code, and it cannot be included in
 *   automated notebook catalogs or HTML exports.
 * - Linear execution order (monotonically increasing cell numbers) is the
 *   evidence of a notebook that runs clean from top to bottom. Out-of-order
 *   execution numbers indicate a notebook that only works interactively.
 * - Extracted functions signal that the notebook has transitioned from
 *   exploration to production-quality code: reusable, testable, importable.
 * - Empty code cells are dead weight: they produce no output, confuse readers,
 *   and prevent clean notebook execution.
 *
 * Escape hatch: none — these are non-negotiable for production notebooks.
 */

const RULES = [
  {
    id: 'has-markdown-title',
    description: 'First cell is a markdown heading',
    test: (cells) => {
      if (!cells.length) return false;
      const first = cells[0];
      if (first.cell_type !== 'markdown') return false;
      const src = Array.isArray(first.source) ? first.source.join('') : first.source;
      return /^#\s+/.test(src);
    }
  },
  {
    id: 'linear-execution-order',
    description: 'Execution counts are monotonically non-decreasing',
    test: (cells) => {
      const codeCells = cells.filter(c => c.cell_type === 'code');
      const counts = codeCells.map(c => c.execution_count).filter(n => typeof n === 'number');
      for (let i = 1; i < counts.length; i++) {
        if (counts[i] < counts[i - 1]) return false;
      }
      return true;
    }
  },
  {
    id: 'has-function-definitions',
    description: 'Contains at least one def statement (logic extracted to functions)',
    test: (cells) => {
      const code = cells
        .filter(c => c.cell_type === 'code')
        .map(c => Array.isArray(c.source) ? c.source.join('') : c.source)
        .join('\n');
      const totalLines = code.split('\n').filter(l => l.trim()).length;
      if (totalLines < 40) return true; // short notebooks exempt
      return /^def\s+\w+/m.test(code);
    }
  },
  {
    id: 'no-empty-cells',
    description: 'No empty code cells',
    test: (cells) => {
      return !cells.some(c => {
        if (c.cell_type !== 'code') return false;
        const src = Array.isArray(c.source) ? c.source.join('') : c.source;
        return src.trim() === '';
      });
    }
  },
];

export async function run({ dir }) {
  const notebooks = readdirSync(dir).filter(f => f.endsWith('.ipynb'));
  if (!notebooks.length) return { pass: false, code: 'JN009', message: 'No .ipynb file found' };

  const violations = [];
  for (const nb of notebooks) {
    let parsed;
    try { parsed = JSON.parse(readFileSync(join(dir, nb), 'utf8')); } catch { continue; }
    const cells = parsed.cells || [];

    for (const rule of RULES) {
      if (!rule.test(cells)) {
        violations.push(`[${rule.id}] ${nb}: ${rule.description}`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'JN009',
      message: `Notebook contract violations`,
      detail: violations.join('\n')
    };
  }

  return { pass: true, code: 'JN009', message: 'All notebook contract rules passed' };
}
