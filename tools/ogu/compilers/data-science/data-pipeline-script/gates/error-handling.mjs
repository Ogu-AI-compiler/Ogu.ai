import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * DP006 — error-handling
 * Data pipeline scripts must implement explicit error handling and fail loudly,
 * not swallow exceptions or continue silently on data errors.
 *
 * Why:
 * - Silent failures are the most dangerous pattern in data pipelines.
 *   A pipeline that catches all exceptions and "continues" will write
 *   partial or corrupted output while reporting success to the orchestrator.
 * - Downstream consumers (models, dashboards, APIs) see the corrupted data
 *   and fail hours or days later — making root cause analysis nearly impossible.
 * - The correct pattern: fail fast and fail loudly. A pipeline failure should:
 *   1. Log the full exception with context (which step, which data)
 *   2. NOT write partial output (use atomic writes or staging)
 *   3. Exit with non-zero status so the orchestrator retries or alerts
 * - Bare `except: pass` and `except Exception: continue` are the primary
 *   anti-patterns. They silently discard errors that need human attention.
 *
 * Escape hatch: # @silent-error-ok: <reason> for intentional error skipping
 * (e.g., skipping malformed records in a streaming pipeline with dead-letter queue).
 */

// Patterns that swallow errors silently
const SILENT_EXCEPT_RE = /except\s*(?:Exception\s*)?\s*:\s*(?:pass|continue)\s*$/m;
const BARE_EXCEPT_PASS = /^\s*except\s*:\s*\n\s*pass/m;
const EXCEPT_CONTINUE  = /except.*:\s*\n\s*continue/m;

// Good patterns — error handling that logs and re-raises or fails loudly
const GOOD_EXCEPT_PATTERNS = [
  /logger\.(error|exception|critical)\s*\(/,
  /logging\.(error|exception|critical)\s*\(/,
  /raise\s+\w/,    // re-raises exception
  /sys\.exit\s*\(/,
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'DP006', message: 'No Python files — error handling check skipped', skipped: true };
  }

  const violations = [];

  for (const file of files) {
    const text  = readFileSync(join(dir, file), 'utf8');
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/@silent-error-ok/.test(line) || (i > 0 && /@silent-error-ok/.test(lines[i - 1]))) continue;

      // Detect bare except/Exception: pass
      if (/^\s*except\s*(?:Exception\s*)?\s*:\s*$/.test(line)) {
        // Look at next non-empty line
        const nextLine = lines.slice(i + 1).find(l => l.trim());
        if (nextLine && /^\s*(?:pass|continue)/.test(nextLine)) {
          violations.push(`${file}:${i + 1} — silent exception: ${line.trim()} → ${nextLine.trim()}`);
        }
      }
    }

    // Check that the file has SOME good error handling if it has exception handlers
    const hasAnyExcept = /except\s*(?:Exception|:)/.test(text);
    const hasGoodHandling = GOOD_EXCEPT_PATTERNS.some(p => p.test(text));

    if (hasAnyExcept && !hasGoodHandling) {
      violations.push(`${file}: exception handlers found but no logging or re-raise detected`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'DP006',
      message: `${violations.length} silent error pattern(s) in pipeline`,
      detail: violations.slice(0, 5).join('\n') +
        '\n\nFix — fail loudly:\n' +
        '  try:\n' +
        '      process_batch(data)\n' +
        '  except ValidationError as e:\n' +
        '      logger.exception("Batch validation failed: %s", e)\n' +
        '      raise  # re-raise — orchestrator will retry or alert\n\n' +
        'For skippable records:\n' +
        '  except ValidationError:  # @silent-error-ok: malformed records go to DLQ\n' +
        '      dead_letter_queue.append(record)\n' +
        '      continue',
    };
  }

  return { pass: true, code: 'DP006', message: 'Error handling present — pipeline fails loudly on exceptions' };
}
