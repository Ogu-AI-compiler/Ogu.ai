import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * QA010 — spec-valid
 * coverage-policy-spec.json must exist and declare all four global thresholds.
 */

const THRESHOLD_KEYS = ['lines', 'branches', 'functions', 'statements'];

export async function run({ dir }) {
  const specPath = join(dir, 'coverage-policy-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'QA010', message: 'coverage-policy-spec.json not found' };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'QA010', message: `Invalid JSON: ${e.message}` };
  }

  if (!spec.global || typeof spec.global !== 'object') {
    return { pass: false, code: 'QA010', message: 'spec.global missing — must declare lines, branches, functions, statements' };
  }

  const missing = THRESHOLD_KEYS.filter(k => typeof spec.global[k] !== 'number');
  if (missing.length) {
    return {
      pass: false, code: 'QA010',
      message: `spec.global missing numeric thresholds: ${missing.join(', ')}`,
    };
  }

  if (!spec.failBuildBelow) {
    return { pass: false, code: 'QA010', message: 'failBuildBelow not declared — must be "global", "per-file", or "none"' };
  }

  return {
    pass: true, code: 'QA010',
    message: `Spec valid — lines:${spec.global.lines}% branches:${spec.global.branches}% functions:${spec.global.functions}% statements:${spec.global.statements}%`,
  };
}
