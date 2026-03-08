import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * DP005 — no-raw-mutation
 * Data pipeline scripts must not mutate raw source DataFrames in-place.
 * All transformations must operate on copies or clearly named derived objects.
 *
 * Why:
 * - In pipelines, raw data is the audit trail. If raw DataFrames are mutated,
 *   the original source data cannot be recovered without re-reading from disk.
 * - Inplace mutations break pipeline observability: if a downstream step fails,
 *   you need to inspect intermediate states. If the "raw" DataFrame was mutated,
 *   the intermediate state is the same as the final state — no rollback.
 * - The correct pattern: read raw, copy immediately, transform the copy.
 *   The copy is cheap relative to re-reading from storage.
 *
 * Escape hatch: # @raw-mutation-ok: <reason>
 */

const INPLACE_PATTERNS = [
  /\.fillna\s*\([^)]*inplace\s*=\s*True/,
  /\.drop\s*\([^)]*inplace\s*=\s*True/,
  /\.dropna\s*\([^)]*inplace\s*=\s*True/,
  /\.rename\s*\([^)]*inplace\s*=\s*True/,
  /\.reset_index\s*\([^)]*inplace\s*=\s*True/,
  /\.sort_values\s*\([^)]*inplace\s*=\s*True/,
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'DP005', message: 'No Python files — mutation check skipped', skipped: true };
  }

  const violations = [];

  for (const file of files) {
    const lines = readFileSync(join(dir, file), 'utf8').split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) continue;
      if (/@raw-mutation-ok/.test(line) || (i > 0 && /@raw-mutation-ok/.test(lines[i - 1]))) continue;

      if (INPLACE_PATTERNS.some(p => p.test(line))) {
        violations.push(`${file}:${i + 1} — ${trimmed.slice(0, 80)}`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'DP005',
      message: `${violations.length} inplace mutation(s) on DataFrame`,
      detail: violations.slice(0, 5).join('\n') +
        '\n\nPrefer functional transforms (return new DataFrame):\n' +
        '  df = df.fillna(0)             # not inplace=True\n' +
        '  df = df.drop(columns=["col"]) # not inplace=True\n' +
        '  df = df.rename(columns={"old": "new"})',
    };
  }

  return { pass: true, code: 'DP005', message: 'No inplace mutations on DataFrames' };
}
