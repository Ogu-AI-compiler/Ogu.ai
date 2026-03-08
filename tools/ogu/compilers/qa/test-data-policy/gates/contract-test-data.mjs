import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA087 — contract-test-data
 * Validates the test-data-policy-artifact.json produced by the runner.
 */

const IR_PREFIX = 'TEST_DATA_POLICY:';

export async function run({ dir }) {
  let artifact;
  try {
    artifact = JSON.parse(readFileSync(join(dir, 'test-data-policy-artifact.json'), 'utf8'));
  } catch {
    return { pass: false, code: 'QA087', message: 'test-data-policy-artifact.json not found — runner must produce it first' };
  }

  const required = ['ir_id', 'strategies', 'isolation', 'piiPolicy', 'attestation'];
  const missing = required.filter(k => artifact[k] === undefined || artifact[k] === null);
  if (missing.length) {
    return { pass: false, code: 'QA087', message: `Artifact missing: ${missing.join(', ')}` };
  }

  if (!artifact.ir_id.startsWith(IR_PREFIX)) {
    return {
      pass: false, code: 'QA087',
      message: `ir_id must start with "${IR_PREFIX}", got: "${artifact.ir_id}"`,
    };
  }

  if (!artifact.attestation?.hash || artifact.attestation.hash.length < 32) {
    return { pass: false, code: 'QA087', message: 'Artifact attestation.hash missing or invalid' };
  }

  if (!Array.isArray(artifact.strategies) || artifact.strategies.length === 0) {
    return { pass: false, code: 'QA087', message: 'Artifact strategies must be a non-empty array' };
  }

  return {
    pass: true, code: 'QA087',
    message: `Artifact valid — ${artifact.ir_id}, strategies: [${artifact.strategies.join(', ')}]`,
  };
}
