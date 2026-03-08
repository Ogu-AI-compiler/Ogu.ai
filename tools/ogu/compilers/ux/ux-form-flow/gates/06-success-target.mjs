/**
 * Gate UFF006 — success-target
 * spec.submission must declare either:
 * - redirectTo (string), OR
 * - onSuccess (string)
 * A form with no success behavior is incomplete.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'form-flow-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UFF006',
      message: 'form-flow-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'UFF006',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (typeof spec.submission !== 'object' || spec.submission === null) {
    return {
      pass: true,
      code: 'UFF006',
      message: 'No submission object — skipped (handled by spec-valid)',
      skipped: true,
    };
  }

  const hasRedirectTo =
    typeof spec.submission.redirectTo === 'string' &&
    spec.submission.redirectTo.trim() !== '';

  const hasOnSuccess =
    typeof spec.submission.onSuccess === 'string' &&
    spec.submission.onSuccess.trim() !== '';

  if (!hasRedirectTo && !hasOnSuccess) {
    return {
      pass: false,
      code: 'UFF006',
      message: 'submission object missing success target — declare redirectTo or onSuccess',
      detail:
        'Every form must define what happens after successful submission. ' +
        'Declare submission.redirectTo (URL or route) or submission.onSuccess (callback id).',
    };
  }

  const declared = hasRedirectTo
    ? `redirectTo="${spec.submission.redirectTo}"`
    : `onSuccess="${spec.submission.onSuccess}"`;

  return {
    pass: true,
    code: 'UFF006',
    message: `success-target: ${declared}`,
  };
}
