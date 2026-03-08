import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * DI004 — logging-not-print
 * Production data ingestion scripts must use Python's logging module,
 * not print() statements.
 *
 * Why:
 * - print() goes to stdout only. Logging frameworks route to files,
 *   cloud logging (CloudWatch, GCP Logging, Datadog), and monitoring systems.
 * - print() has no log level. You can't turn off debug output in production
 *   or escalate errors to alerting systems.
 * - Orchestrators (Airflow, Prefect, Luigi) capture logs from the logging
 *   module. print() is invisible in their UIs and alerting pipelines.
 * - In scheduled/automated runs, unstructured print() output becomes noise
 *   that nobody reads. Structured log records are searchable and filterable.
 *
 * Acceptable print() uses:
 * - CLI entrypoint scripts where user-facing output is intentional
 * - __main__ blocks with explicit user prompts
 *
 * Escape hatch: # @print-ok: <reason> on the line with print().
 */

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'DI004', message: 'No Python files — logging check skipped', skipped: true };
  }

  const violations = [];
  let hasLogging = false;

  for (const file of files) {
    const text  = readFileSync(join(dir, file), 'utf8');
    const lines = text.split('\n');

    if (/import logging\b|from logging import/.test(text)) hasLogging = true;

    let inMain = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) continue;

      // Track if we're in the if __name__ == '__main__' block
      if (/if\s+__name__\s*==\s*['"]__main__['"]/.test(trimmed)) {
        inMain = true;
      }

      // Escape hatch
      if (/@print-ok/.test(line) || (i > 0 && /@print-ok/.test(lines[i - 1]))) continue;

      // Detect bare print() — not inside __main__ block for CLI output
      if (/^\s*print\s*\(/.test(line) && !inMain) {
        violations.push(`${file}:${i + 1} — ${trimmed.slice(0, 80)}`);
      }
    }
  }

  if (violations.length && !hasLogging) {
    return {
      pass: false, code: 'DI004',
      message: `${violations.length} print() call(s) — no logging configured`,
      detail: violations.slice(0, 5).join('\n') +
        '\n\nAdd at module top:\n  import logging\n  logger = logging.getLogger(__name__)\n\nThen replace print() with:\n  logger.info("Loaded %d rows", len(df))\n  logger.warning("Missing values in column %s", col)',
    };
  }

  if (violations.length) {
    return {
      pass: false, code: 'DI004',
      message: `${violations.length} print() call(s) — replace with logger.info/debug/warning`,
      detail: violations.slice(0, 5).join('\n') + '\n\nAdd # @print-ok: <reason> for intentional print() (e.g. CLI output).',
    };
  }

  return { pass: true, code: 'DI004', message: `Structured logging used — no bare print() calls` };
}
