/**
 * Gate URF004 — escape-hatch
 * Every failure with severity "critical" or "fatal" must declare `escapeHatch`:
 * an action that returns the user to a known safe state.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const CRITICAL_SEVERITIES = new Set(['critical', 'fatal']);

export async function run({ dir }) {
  const specPath = join(dir, 'recovery-flow-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'URF004',
      message: 'recovery-flow-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'URF004',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.failures) || spec.failures.length === 0) {
    return {
      pass: true,
      code: 'URF004',
      message: 'No failures to check — gate skipped',
      skipped: true,
    };
  }

  // Only check failures with critical or fatal severity
  const criticalFailures = spec.failures.filter(
    f => CRITICAL_SEVERITIES.has(f.severity)
  );

  if (criticalFailures.length === 0) {
    return {
      pass: true,
      code: 'URF004',
      message: 'escape-hatch: no critical/fatal failures — gate not applicable',
      skipped: true,
    };
  }

  const violations = [];

  for (const failure of criticalFailures) {
    const label = `failure(id="${failure.id ?? 'unknown'}", severity="${failure.severity}")`;

    // escapeHatch must be a non-empty string
    const hasEscapeHatch =
      typeof failure.escapeHatch === 'string' && failure.escapeHatch.trim() !== '';

    if (!hasEscapeHatch) {
      violations.push(
        `${label} missing escapeHatch declaration — ` +
        'critical/fatal failures must provide an exit to a known safe state ' +
        '(e.g., "go-home", "contact-support", "reload")'
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'URF004',
      message: `${violations.length} critical/fatal failure(s) missing escapeHatch`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'URF004',
    message: `escape-hatch: all ${criticalFailures.length} critical/fatal failure(s) declare escapeHatch`,
  };
}
