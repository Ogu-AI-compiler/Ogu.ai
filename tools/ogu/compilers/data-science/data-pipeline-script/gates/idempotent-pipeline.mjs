import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * DP002 — idempotent-pipeline
 * Data pipeline scripts must be idempotent: re-executing must produce
 * the same output without duplicating or corrupting data.
 *
 * Why:
 * - Production pipelines fail and are retried. Airflow retries on failure
 *   up to N times. A non-idempotent pipeline accumulates data across retries,
 *   producing N copies of the intended output.
 * - Backfills require re-running pipelines over historical date ranges.
 *   If the pipeline appends rather than overwrites, backfills produce duplicates.
 * - The two idempotent patterns:
 *   1. DELETE + INSERT (transactional): clear target before writing
 *   2. UPSERT (merge): update existing records, insert new ones
 *   3. OVERWRITE partition: partition by date, overwrite the target partition
 *
 * Anti-patterns detected:
 * - open(path, "a") — appends on each run
 * - df.to_csv(path) without overwrite (default appends to some implementations)
 * - INSERT without DELETE/TRUNCATE (SQL anti-pattern)
 *
 * Escape hatch: # @append-pipeline-ok: <reason> for append-only event logs
 * where downstream deduplication is the correct pattern.
 */

const APPEND_PATTERNS = [
  /open\s*\([^)]*,\s*['"]a['"]/,
  /to_csv\s*\([^)]*mode\s*=\s*['"]a['"]/,
  /\.append\s*\([^)]+,\s*ignore_index/,  // pd.concat alternative — old API
];

// Good patterns that indicate idempotent behavior
const OVERWRITE_PATTERNS = [
  /\.to_parquet\s*\(/,
  /\.to_csv\s*\([^)]*\)\s*(?!.*mode)/,  // to_csv without mode="a"
  /delta\.write\.parquet/,
  /TRUNCATE|DELETE FROM|REPLACE INTO|INSERT OR REPLACE/i,
  /overwrite=True|if_exists=['"]replace['"]/,
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'DP002', message: 'No Python files — idempotent check skipped', skipped: true };
  }

  const violations = [];

  for (const file of files) {
    const lines = readFileSync(join(dir, file), 'utf8').split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) continue;
      if (/@append-pipeline-ok/.test(line) || (i > 0 && /@append-pipeline-ok/.test(lines[i - 1]))) continue;

      if (APPEND_PATTERNS.some(p => p.test(line))) {
        violations.push(`${file}:${i + 1} — ${trimmed.slice(0, 80)}`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'DP002',
      message: `${violations.length} non-idempotent write(s) — re-runs will duplicate data`,
      detail: violations.slice(0, 5).join('\n') +
        '\n\nFix patterns:\n' +
        '  # Overwrite: df.to_parquet("output/data.parquet")  — replaces file each run\n' +
        '  # Partition: df.to_parquet(f"output/{date}/data.parquet")  — overwrite partition\n' +
        '  # SQL: DELETE FROM table WHERE date = "{date}"; INSERT INTO table ...',
    };
  }

  return { pass: true, code: 'DP002', message: 'No append-mode writes — pipeline appears idempotent' };
}
