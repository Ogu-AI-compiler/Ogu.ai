import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * SA006 — logging-not-print
 * ML serving API code must use structured logging, not print() statements.
 *
 * Why:
 * - Serving APIs run as long-lived processes in containers. Their logs go to
 *   container log aggregators (Datadog, CloudWatch, GCP Logging, ELK stack).
 *   print() outputs appear as unstructured strings with no log level, no
 *   timestamp, and no correlation ID — impossible to search or alert on.
 * - Structured logging (Python logging module or structlog) adds:
 *   - Log level (DEBUG/INFO/WARNING/ERROR) for filtering
 *   - Timestamp and process info automatically
 *   - Correlation IDs for tracing requests end-to-end
 *   - JSON format for machine-parseable log aggregation
 * - Inference latency, feature values, prediction distributions — all should
 *   be logged as structured records for monitoring and debugging.
 * - print() in a production API is the equivalent of printf debugging in C:
 *   it was meant for local development and must be cleaned up before shipping.
 *
 * Escape hatch: # @print-ok: <reason> for CLI output in management scripts,
 * or for startup banner messages where structured logging isn't configured yet.
 */

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'SA006', message: 'No Python files — logging check skipped', skipped: true };
  }

  const violations = [];
  let hasLogging = false;

  for (const file of files) {
    const text  = readFileSync(join(dir, file), 'utf8');
    const lines = text.split('\n');

    if (/import logging\b|from logging import|import structlog/.test(text)) hasLogging = true;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) continue;
      if (/@print-ok/.test(line) || (i > 0 && /@print-ok/.test(lines[i - 1]))) continue;
      if (/^\s*print\s*\(/.test(line)) {
        violations.push(`${file}:${i + 1} — ${trimmed.slice(0, 80)}`);
      }
    }
  }

  if (violations.length && !hasLogging) {
    return {
      pass: false, code: 'SA006',
      message: `${violations.length} print() call(s) — no logging configured`,
      detail: violations.slice(0, 5).join('\n') +
        '\n\nAdd structured logging:\n' +
        '  import logging\n' +
        '  logger = logging.getLogger(__name__)\n\n' +
        '  # Configure at startup:\n' +
        '  logging.basicConfig(\n' +
        '      level=logging.INFO,\n' +
        '      format="%(asctime)s %(name)s %(levelname)s %(message)s"\n' +
        '  )\n\n' +
        '  # In request handler:\n' +
        '  logger.info("Prediction request", extra={"latency_ms": elapsed, "model_v": MODEL_VERSION})',
    };
  }

  if (violations.length) {
    return {
      pass: false, code: 'SA006',
      message: `${violations.length} print() call(s) — replace with logger`,
      detail: violations.slice(0, 5).join('\n'),
    };
  }

  return { pass: true, code: 'SA006', message: 'Structured logging used — no bare print() calls' };
}
