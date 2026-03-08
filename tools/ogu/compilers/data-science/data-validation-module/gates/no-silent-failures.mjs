import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * DV004 — no-silent-failures
 * Validation code must not catch validation exceptions without logging
 * or re-raising — silent validation failures are worse than no validation.
 *
 * Why:
 * - A validation exception that is swallowed silently creates a false sense
 *   of safety: the validation "ran" (no errors) but actually caught and
 *   ignored data quality problems. The bad data proceeds unchecked.
 * - The correct response to a validation failure depends on the pipeline:
 *   - Critical path: raise the exception (halt pipeline, trigger alerts)
 *   - Non-critical: log at WARNING/ERROR + send to dead letter queue
 * - "lazy=True" in pandera collects all errors before raising.
 *   It's appropriate when you want to see ALL validation errors at once.
 *   But it must still raise at the end — not be caught and suppressed.
 * - The most dangerous pattern: wrapping validation in try/except:pass
 *   to silence a failing validation while a backlog is being cleaned up.
 *   This is a temporary workaround that becomes permanent technical debt.
 *
 * Escape hatch: # @validation-silent-ok: <reason> for legitimate cases
 * where validation errors are handled by a downstream error recovery system.
 */

const SILENCE_PATTERNS = [
  /except\s*(?:SchemaError|ValidationError|pa\.errors\.\w+|Exception)\s*(?:as\s+\w+)?\s*:\s*\n\s*pass/m,
  /except\s*(?:SchemaError|ValidationError)\s*(?:as\s+\w+)?\s*:\s*\n\s*continue/m,
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'DV004', message: 'No Python files — silent failure check skipped', skipped: true };
  }

  const violations = [];

  for (const file of files) {
    const text  = readFileSync(join(dir, file), 'utf8');
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/@validation-silent-ok/.test(line) || (i > 0 && /@validation-silent-ok/.test(lines[i - 1]))) continue;

      // Detect: except ValidationError/SchemaError: (next non-empty line is pass or continue)
      if (/except\s*(?:SchemaError|ValidationError|pa\.errors)/.test(line)) {
        const rest = lines.slice(i + 1).find(l => l.trim());
        if (rest && /^\s*(?:pass|continue)\s*$/.test(rest)) {
          violations.push(`${file}:${i + 1} — validation exception silently swallowed`);
        } else if (rest && !/raise|logger\.|logging\.|log\./.test(rest)) {
          violations.push(`${file}:${i + 1} — validation exception caught without logging or re-raising`);
        }
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'DV004',
      message: `${violations.length} silent validation failure(s)`,
      detail: violations.slice(0, 5).join('\n') +
        '\n\nFix — always raise or log on validation failure:\n' +
        '  # Option 1: fail loudly (recommended for critical data)\n' +
        '  validated = schema.validate(df)  # raises SchemaError if invalid\n\n' +
        '  # Option 2: log and quarantine\n' +
        '  try:\n' +
        '      validated = schema.validate(df)\n' +
        '  except pa.errors.SchemaError as e:\n' +
        '      logger.error("Validation failed: %s", e)\n' +
        '      quarantine_df.to_parquet(f"quarantine/{date}.parquet")\n' +
        '      raise  # still re-raise for pipeline to know',
    };
  }

  return { pass: true, code: 'DV004', message: 'Validation failures raise or log — not silently swallowed' };
}
