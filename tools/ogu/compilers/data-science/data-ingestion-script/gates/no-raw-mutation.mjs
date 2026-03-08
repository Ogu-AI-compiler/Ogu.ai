import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * DI005 — no-raw-mutation
 * Data ingestion scripts must not mutate raw source data in-place.
 *
 * Why: same as DP005. At the ingestion layer specifically:
 * - Raw data is the source of truth for the entire pipeline.
 *   Mutations at ingestion corrupt this ground truth irreversibly.
 * - Ingestion scripts often read data that is then versioned and stored.
 *   If the "raw" data has been silently cleaned, the stored artifact
 *   doesn't match the actual source — breaking data lineage.
 *
 * Escape hatch: # @raw-mutation-ok: <reason>
 */

const INPLACE_PATTERNS = [
  /\.fillna\s*\([^)]*inplace\s*=\s*True/,
  /\.drop\s*\([^)]*inplace\s*=\s*True/,
  /\.dropna\s*\([^)]*inplace\s*=\s*True/,
  /\.rename\s*\([^)]*inplace\s*=\s*True/,
  /\.reset_index\s*\([^)]*inplace\s*=\s*True/,
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'DI005', message: 'No Python files — mutation check skipped', skipped: true };
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
      pass: false, code: 'DI005',
      message: `${violations.length} inplace mutation(s) on raw data`,
      detail: violations.slice(0, 5).join('\n') +
        '\n\nCreate a copy before transforming:\n' +
        '  raw_df = pd.read_csv(source_path)\n' +
        '  df = raw_df.copy()  # preserve raw\n' +
        '  df = df.fillna(0)   # not inplace=True',
    };
  }

  return { pass: true, code: 'DI005', message: 'No inplace mutations — raw data preserved' };
}
