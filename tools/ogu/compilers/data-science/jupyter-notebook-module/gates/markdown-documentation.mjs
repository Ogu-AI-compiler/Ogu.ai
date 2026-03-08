import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * JN003 — markdown-documentation
 * Production notebooks must have a meaningful proportion of markdown cells
 * documenting the analysis — not just code cells with bare computations.
 *
 * Why:
 * - Code cells explain HOW. Markdown cells explain WHY.
 *   A notebook without markdown is code without documentation — it shows
 *   what was computed but not why those computations were chosen.
 * - Production notebooks are read by people who weren't in the room when
 *   the analysis decisions were made. They need context.
 * - The first cell must be a markdown heading introducing the notebook's
 *   purpose. This is the README of the notebook.
 *
 * Escape hatch: add "markdownMinimal": true to notebook-spec.json for
 * code-only utility notebooks where markdown adds no value.
 */


export async function run({ dir }) {
  const notebooks = readdirSync(dir).filter(f => f.endsWith('.ipynb'));
  if (!notebooks.length) return { pass: false, code: 'JN003', message: 'No .ipynb file found' };

  const violations = [];
  for (const nb of notebooks) {
    let parsed;
    try { parsed = JSON.parse(readFileSync(join(dir, nb), 'utf8')); } catch { continue; }

    const cells = parsed.cells || [];
    const markdownCells = cells.filter(c => c.cell_type === 'markdown');
    const codeCells = cells.filter(c => c.cell_type === 'code');

    if (cells.length === 0) continue;

    // Must have at least some markdown cells
    if (markdownCells.length === 0) {
      violations.push(`${nb}: no markdown cells found — notebook has no documentation`);
      continue;
    }

    // Ratio check: at least 1 markdown cell per 4 code cells
    if (codeCells.length > 4 && markdownCells.length < codeCells.length / 4) {
      violations.push(`${nb}: too few markdown cells (${markdownCells.length} markdown vs ${codeCells.length} code) — document your analysis`);
    }

    // First cell should be a markdown title
    const firstCell = cells[0];
    if (firstCell.cell_type !== 'markdown') {
      violations.push(`${nb}: first cell should be a markdown title cell, not code`);
    } else {
      const src = Array.isArray(firstCell.source) ? firstCell.source.join('') : firstCell.source;
      if (!src.startsWith('#')) {
        violations.push(`${nb}: first markdown cell should start with a heading (#)`);
      }
    }

    // Check for section headings
    const markdownContent = markdownCells
      .map(c => Array.isArray(c.source) ? c.source.join('') : c.source)
      .join('\n');
    const headings = (markdownContent.match(/^#{1,3}\s+.+/gm) || []);
    if (headings.length < 2) {
      violations.push(`${nb}: fewer than 2 section headings — structure with ## headings`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'JN003',
      message: `Notebook documentation insufficient`,
      detail: violations.join('\n')
    };
  }

  return { pass: true, code: 'JN003', message: 'Notebook(s) are well-documented with markdown' };
}
