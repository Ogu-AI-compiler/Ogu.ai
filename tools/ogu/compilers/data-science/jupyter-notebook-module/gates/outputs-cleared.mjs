import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * JN004 — outputs-cleared
 * Production notebook cells must not contain large embedded outputs
 * (base64 images, 100+ line text dumps) that bloat the .ipynb file.
 *
 * Why:
 * - Notebooks with embedded outputs grow to megabytes, making git diffs
 *   unreadable and repository history bloated.
 * - Large embedded images (base64 PNG) change on every run even if the
 *   code doesn't — causing spurious git conflicts and bloating commit history.
 * - Outputs should be regenerated on demand, not stored in the notebook.
 *   Use nbstripout or clear outputs before committing.
 *
 * Escape hatch: add "outputsAllowed": true to notebook-spec.json for
 * notebooks where output persistence is intentional (e.g., static reports).
 */


export async function run({ dir }) {
  const notebooks = readdirSync(dir).filter(f => f.endsWith('.ipynb'));
  if (!notebooks.length) return { pass: false, code: 'JN004', message: 'No .ipynb file found' };

  const violations = [];
  for (const nb of notebooks) {
    let parsed;
    try { parsed = JSON.parse(readFileSync(join(dir, nb), 'utf8')); } catch { continue; }

    const cells = parsed.cells || [];
    const cellsWithOutputs = cells.filter(c =>
      c.cell_type === 'code' &&
      Array.isArray(c.outputs) &&
      c.outputs.length > 0
    );

    const largeBinaryOutputs = cellsWithOutputs.filter(c =>
      c.outputs.some(o =>
        (o.data && (o.data['image/png'] || o.data['image/jpeg'])) ||
        (o.output_type === 'display_data' && o.data && o.data['image/png'])
      )
    );

    // Check if notebook has outputs embedded (images/rich outputs inflate repo size)
    if (largeBinaryOutputs.length > 0) {
      violations.push(`${nb}: ${largeBinaryOutputs.length} cell(s) contain embedded images/binary outputs — clear outputs before committing (git diff gets huge)`);
    }

    // Check for excessively long text outputs (>100 lines per cell)
    const longTextOutputs = cellsWithOutputs.filter(c =>
      c.outputs.some(o => {
        const text = Array.isArray(o.text) ? o.text.join('') : (o.text || '');
        return text.split('\n').length > 100;
      })
    );
    if (longTextOutputs.length > 0) {
      violations.push(`${nb}: ${longTextOutputs.length} cell(s) have text output exceeding 100 lines — truncate or suppress verbose output`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'JN004',
      message: `Notebook outputs should be cleared`,
      detail: violations.join('\n') + '\nRun: jupyter nbconvert --clear-output --inplace *.ipynb'
    };
  }

  return { pass: true, code: 'JN004', message: 'Notebook outputs are clean (no embedded images or excessive text)' };
}
