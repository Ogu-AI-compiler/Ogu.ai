import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * DI006 — idempotent-output
 * Data ingestion scripts must be safe to re-run: re-executing must produce
 * the same output, not duplicate or corrupt existing data.
 *
 * Why:
 * - Scheduled jobs fail and are retried. If ingestion appends to files on
 *   each run, a retry after a partial failure doubles the data.
 * - ETL pipelines are re-run during backfills, debugging, and schema changes.
 *   Non-idempotent scripts require manual cleanup before each re-run.
 * - The two safe patterns:
 *   1. Overwrite: write to a fixed path, overwriting previous output.
 *      df.to_parquet("output/raw.parquet", index=False)
 *   2. Partition: write to a path that encodes the date/batch ID.
 *      df.to_parquet(f"output/raw/{date}.parquet", index=False)
 *      Re-running overwrites the same partition, not a new one.
 *
 * Bad pattern: open("output.csv", "a") — re-runs append duplicate rows.
 *
 * Escape hatch: # @append-ok: <reason> for legitimate append cases
 * (e.g. append-only audit logs where deduplication happens downstream).
 */

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'DI006', message: 'No Python files — idempotent check skipped', skipped: true };
  }

  const violations = [];

  for (const file of files) {
    const lines = readFileSync(join(dir, file), 'utf8').split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) continue;

      // Escape hatch
      if (/@append-ok/.test(line) || (i > 0 && /@append-ok/.test(lines[i - 1]))) continue;

      // Detect append mode opens
      if (/open\s*\([^)]*,\s*['"]a['"]/.test(line)) {
        violations.push(`${file}:${i + 1} — append mode: ${trimmed.slice(0, 80)}`);
      }

      // Detect DataFrame append operations that grow a file
      if (/\.to_csv\s*\([^)]*mode\s*=\s*['"]a['"]/.test(line)) {
        violations.push(`${file}:${i + 1} — to_csv(mode="a"): ${trimmed.slice(0, 80)}`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'DI006',
      message: `${violations.length} non-idempotent write(s) — re-run would duplicate data`,
      detail: violations.slice(0, 5).join('\n') +
        '\n\nFix options:\n' +
        '  1. Overwrite: df.to_csv("output.csv", mode="w", index=False)\n' +
        '  2. Partition: df.to_parquet(f"output/{date}.parquet")\n' +
        '  3. Add # @append-ok: <reason> if append is intentional and deduplication happens downstream.',
    };
  }

  return { pass: true, code: 'DI006', message: 'No append-mode writes — idempotent output pattern' };
}
