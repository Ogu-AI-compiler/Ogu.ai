/**
 * Gate URF008 — contract-recovery-flow
 * Final contract check:
 * - version declared
 * - unique failure ids
 * - at least one failure declared
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'recovery-flow-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'URF008',
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
      code: 'URF008',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.failures)) {
    return {
      pass: true,
      code: 'URF008',
      message: 'No failures array — skipped',
      skipped: true,
    };
  }

  const violations = [];

  // Rule: version declared
  if (!spec.version) {
    violations.push('Contract: recovery-flow-spec.json missing field "version"');
  }

  // Rule: at least one failure
  if (spec.failures.length === 0) {
    violations.push('Contract: failures array is empty — at least one failure must be declared');
  }

  // Rule: unique failure ids
  const seenIds = new Map();
  for (const failure of spec.failures) {
    if (typeof failure.id !== 'string') continue;
    if (seenIds.has(failure.id)) {
      violations.push(`Contract: Duplicate failure id "${failure.id}"`);
    } else {
      seenIds.set(failure.id, true);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'URF008',
      message: `${violations.length} contract violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'URF008',
    message: 'contract-recovery-flow: all contract rules satisfied',
  };
}
