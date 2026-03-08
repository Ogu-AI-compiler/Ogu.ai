import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * DP004 — logging-not-print
 * Data pipeline scripts must use structured logging — not print() statements.
 *
 * Why: same reasoning as DI004 and SA006 — print() is invisible to
 * orchestrators, log aggregators, and monitoring systems.
 *
 * Additional context for pipelines:
 * - ETL pipelines process large volumes of data. Progress logging
 *   (processed N records, skipped M, failed K) is essential for
 *   monitoring long-running jobs and detecting stuck pipelines.
 * - Structured log entries with batch_id, partition_date, record_count
 *   enable aggregation and trending in log management tools.
 * - print() appears in orchestrator logs as an undifferentiated blob.
 *   Structured logger.info() with extra fields is searchable and alertable.
 *
 * Escape hatch: # @print-ok: <reason>
 */

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'DP004', message: 'No Python files — logging check skipped', skipped: true };
  }

  const violations = [];
  let hasLogging = false;

  for (const file of files) {
    const text  = readFileSync(join(dir, file), 'utf8');
    const lines = text.split('\n');

    if (/import logging\b|from logging import|import structlog/.test(text)) hasLogging = true;

    let inMain = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) continue;
      if (/if\s+__name__\s*==\s*['"]__main__['"]/.test(trimmed)) inMain = true;
      if (/@print-ok/.test(line) || (i > 0 && /@print-ok/.test(lines[i - 1]))) continue;
      if (/^\s*print\s*\(/.test(line) && !inMain) {
        violations.push(`${file}:${i + 1} — ${trimmed.slice(0, 80)}`);
      }
    }
  }

  if (violations.length && !hasLogging) {
    return {
      pass: false, code: 'DP004',
      message: `${violations.length} print() call(s) — no logging configured`,
      detail: violations.slice(0, 5).join('\n') +
        '\n\nReplace with:\n  import logging\n  logger = logging.getLogger(__name__)\n  logger.info("Processed %d records in partition %s", count, partition_date)',
    };
  }

  if (violations.length) {
    return {
      pass: false, code: 'DP004',
      message: `${violations.length} print() call(s) — replace with logger`,
      detail: violations.slice(0, 5).join('\n'),
    };
  }

  return { pass: true, code: 'DP004', message: 'Structured logging used — no bare print() calls' };
}
