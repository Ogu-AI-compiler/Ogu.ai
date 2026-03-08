/**
 * Gate URF005 — offline-fallback
 * If spec has any failure with trigger containing "offline" or "network",
 * that failure must have a `fallback` declared.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'recovery-flow-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'URF005',
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
      code: 'URF005',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.failures) || spec.failures.length === 0) {
    return {
      pass: true,
      code: 'URF005',
      message: 'No failures to check — gate skipped',
      skipped: true,
    };
  }

  // Find failures whose trigger string mentions offline or network connectivity
  const networkFailures = spec.failures.filter(f => {
    if (typeof f.trigger !== 'string') return false;
    const trigger = f.trigger.toLowerCase();
    return trigger.includes('offline') || trigger.includes('network');
  });

  if (networkFailures.length === 0) {
    return {
      pass: true,
      code: 'URF005',
      message: 'offline-fallback: no offline/network failures declared — gate not applicable',
      skipped: true,
    };
  }

  const violations = [];

  for (const failure of networkFailures) {
    const label = `failure(id="${failure.id ?? 'unknown'}", trigger="${failure.trigger}")`;

    const recovery = failure.recovery;
    const hasFallback =
      typeof recovery === 'object' &&
      recovery !== null &&
      Object.prototype.hasOwnProperty.call(recovery, 'fallback') &&
      recovery.fallback !== null &&
      recovery.fallback !== undefined &&
      recovery.fallback !== false;

    if (!hasFallback) {
      violations.push(
        `${label} has no fallback declared — ` +
        'offline/network failures must declare a fallback (cached content, read-only mode, or offline message)'
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'URF005',
      message: `${violations.length} offline/network failure(s) missing fallback`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'URF005',
    message: `offline-fallback: all ${networkFailures.length} offline/network failure(s) declare fallback`,
  };
}
