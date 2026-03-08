import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * QA001 — spec-valid
 * test-harness-spec.json must exist and contain all required fields.
 */

const REQUIRED = ['runner', 'environments', 'coverage', 'reporters', 'timeouts', 'mockStrategy'];
const VALID_RUNNERS = ['vitest', 'jest', 'playwright', 'mocha', 'jasmine'];

export async function run({ dir }) {
  const specPath = join(dir, 'test-harness-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'QA001', message: 'test-harness-spec.json not found' };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'QA001', message: `test-harness-spec.json invalid JSON: ${e.message}` };
  }

  const missing = REQUIRED.filter(k => !(k in spec));
  if (missing.length) {
    return { pass: false, code: 'QA001', message: `Missing required fields: ${missing.join(', ')}` };
  }

  if (!VALID_RUNNERS.includes(spec.runner)) {
    return {
      pass: false, code: 'QA001',
      message: `runner '${spec.runner}' not recognised — must be one of: ${VALID_RUNNERS.join(', ')}`,
    };
  }

  if (!spec.environments || typeof spec.environments !== 'object' || Array.isArray(spec.environments)) {
    return { pass: false, code: 'QA001', message: 'environments must be an object mapping env names to settings' };
  }

  if (!spec.coverage || typeof spec.coverage !== 'object') {
    return { pass: false, code: 'QA001', message: 'coverage must be an object' };
  }

  if (!Array.isArray(spec.reporters) || spec.reporters.length === 0) {
    return { pass: false, code: 'QA001', message: 'reporters must be a non-empty array' };
  }

  return {
    pass: true, code: 'QA001',
    message: `Spec valid — runner: ${spec.runner}, environments: ${Object.keys(spec.environments).join(', ')}`,
  };
}
