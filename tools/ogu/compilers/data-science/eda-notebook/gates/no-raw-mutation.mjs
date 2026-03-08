import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * EN006 — no-raw-mutation
 * EDA notebooks must not mutate raw data — all transformations must
 * operate on copies or explicitly named derived DataFrames.
 *
 * Why:
 * - EDA is explorative: cells are run out of order, re-run, and modified.
 *   If a cell mutates the original raw DataFrame, re-running earlier cells
 *   may produce different results because the "raw" data is already dirty.
 * - Mutating raw data in EDA leads to: invisible state bugs (outputs depend
 *   on cell execution order), inability to restart and reproduce, and
 *   accidental contamination of downstream pipeline steps that import from
 *   the notebook.
 * - The correct pattern: read raw data once, create a clean copy immediately,
 *   apply all transformations to the copy.
 *
 * Escape hatch: # @raw-mutation-ok: <reason> for intentional in-place
 * operations that are part of a documented cleaning pipeline.
 */

// Patterns that modify data in-place on potentially-raw variables
const INPLACE_RE = /(?:df|data|raw_df|dataset)\s*\.\s*\w+\s*\(.*inplace\s*=\s*True/;
const INDEX_ASSIGN_RE = /(?:df|data|raw_df)\s*\[['"`]\w+['"`]\]\s*=\s*(?!None)/;  // df['col'] = value on raw df
const DROP_INPLACE_RE = /\.drop\s*\([^)]*inplace\s*=\s*True/;

// Good: explicit copy before mutation
const COPY_PATTERNS = [
  /=\s*(?:df|data|raw_df)\s*\.\s*copy\s*\(\)/,
  /df_clean|df_processed|df_transformed|working_df|analysis_df/,
];

function extractPyCode(dir) {
  const parts = [];
  for (const file of readdirSync(dir)) {
    if (file.endsWith('.ipynb')) {
      try {
        const nb = JSON.parse(readFileSync(join(dir, file), 'utf8'));
        for (const cell of nb.cells ?? []) {
          if (cell.cell_type === 'code') parts.push((cell.source ?? []).join(''));
        }
      } catch { /* skip */ }
    } else if (file.endsWith('.py')) {
      parts.push(readFileSync(join(dir, file), 'utf8'));
    }
  }
  return parts.join('\n');
}

export async function run({ dir }) {
  const content = extractPyCode(dir);
  if (!content.trim()) {
    return { pass: true, code: 'EN006', message: 'No code cells found — mutation check skipped', skipped: true };
  }

  if (/@raw-mutation-ok/.test(content)) {
    return { pass: true, code: 'EN006', message: '@raw-mutation-ok — in-place operations intentional', skipped: true };
  }

  const hasExplicitCopy = COPY_PATTERNS.some(p => p.test(content));

  // Check for problematic inplace operations
  const hasInplace  = INPLACE_RE.test(content) || DROP_INPLACE_RE.test(content);

  if (hasInplace && !hasExplicitCopy) {
    return {
      pass: false, code: 'EN006',
      message: 'In-place mutations on raw DataFrame without explicit copy',
      detail: 'Create an explicit copy before transformations:\n\n' +
        '  # At the top of your notebook\n' +
        '  df_raw = pd.read_csv("data/raw.csv")\n' +
        '  df = df_raw.copy()  # work on copy, raw stays pristine\n\n' +
        '  # All mutations on df (not df_raw)\n' +
        '  df["age"].fillna(df["age"].median(), inplace=True)\n\n' +
        '  # To restart: df = df_raw.copy() — always fresh start',
    };
  }

  return { pass: true, code: 'EN006', message: 'Raw data not mutated — explicit copies used' };
}
