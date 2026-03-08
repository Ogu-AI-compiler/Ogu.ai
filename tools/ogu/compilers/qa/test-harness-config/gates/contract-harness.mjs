import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * QA009 — contract-harness
 * Validates the compiled test-harness-artifact.json:
 * - File must exist (produced by runner)
 * - Must have ir_id, runner, environments, coverage, reporters, attestation.hash
 * - ir_id must start with TEST_HARNESS_CONFIG:
 */

export async function run({ dir }) {
  const ap = join(dir, 'test-harness-artifact.json');
  if (!existsSync(ap)) {
    return { pass: false, code: 'QA009', message: 'test-harness-artifact.json not found' };
  }

  let a;
  try {
    a = JSON.parse(readFileSync(ap, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'QA009', message: `Invalid JSON in artifact: ${e.message}` };
  }

  const required = ['ir_id', 'runner', 'environments', 'coverage', 'reporters', 'attestation'];
  const missing = required.filter(k => !(k in a));
  if (missing.length) {
    return { pass: false, code: 'QA009', message: `Artifact missing fields: ${missing.join(', ')}` };
  }

  if (!a.ir_id.startsWith('TEST_HARNESS_CONFIG:')) {
    return { pass: false, code: 'QA009', message: 'ir_id must start with TEST_HARNESS_CONFIG:' };
  }

  if (!a.attestation?.hash) {
    return { pass: false, code: 'QA009', message: 'attestation.hash missing' };
  }

  return {
    pass: true, code: 'QA009',
    message: `Harness artifact valid — runner: ${a.runner}, environments: ${Object.keys(a.environments || {}).join(', ')}`,
  };
}
