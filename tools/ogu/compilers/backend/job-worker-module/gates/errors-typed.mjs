import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * JW005 — errors-typed
 * Workers must distinguish retryable errors from non-retryable ones.
 * BullMQ: throw new UnrecoverableError('...') to stop retries.
 * Bull: job.discard() or specific error types.
 *
 * If there's only a generic `throw new Error(...)` in the processor with no
 * classification, it means ALL errors will be retried (including validation errors,
 * which should not be retried).
 *
 * Require: UnrecoverableError import OR a custom error class hierarchy with
 * a clear retryable vs non-retryable distinction.
 */

const UNRECOVERABLE = /UnrecoverableError|NonRetryableError|PermanentError|job\.discard\(\)/;
const GENERIC_THROW_ONLY = /throw\s+new\s+Error\s*\(/;
const TYPED_THROW = /throw\s+new\s+(?!Error\b)\w+(?:Error|Exception)\s*\(/;

function collectFiles(dir) {
  const files = [];
  function walk(d) {
    let entries; try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) { if (!['node_modules', 'dist', '.git', '__tests__', 'tests'].includes(e.name)) walk(join(d, e.name)); }
      else if (e.name.match(/\.(ts|mjs|js)$/) && !e.name.match(/\.(test|spec|d)\./)) files.push(join(d, e.name));
    }
  }
  walk(dir);
  return files;
}

export async function run({ dir }) {
  const files = collectFiles(dir);
  const allContent = files.map(f => readFileSync(f, 'utf8')).join('\n');

  const hasUnrecoverable = UNRECOVERABLE.test(allContent);
  const hasTypedThrow = TYPED_THROW.test(allContent);
  const hasOnlyGeneric = GENERIC_THROW_ONLY.test(allContent) && !hasUnrecoverable && !hasTypedThrow;

  if (hasOnlyGeneric) {
    return {
      pass: false, code: 'JW005',
      message: 'Only generic Error throws found — classify errors as retryable vs non-retryable',
      detail: 'Use: throw new UnrecoverableError("validation failed") for errors that should not be retried.\nUse: throw new Error("transient failure") for retryable errors.'
    };
  }

  if (!hasUnrecoverable && !hasTypedThrow) {
    return { pass: true, code: 'JW005', message: 'No throw statements detected — error classification check skipped', skipped: true };
  }

  return {
    pass: true, code: 'JW005',
    message: hasUnrecoverable
      ? `UnrecoverableError pattern found — errors properly classified`
      : `Typed error classes found — error classification present`
  };
}
