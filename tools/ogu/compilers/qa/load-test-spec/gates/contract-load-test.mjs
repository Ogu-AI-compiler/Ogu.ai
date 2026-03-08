import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA049 — contract-load-test
 * Validates the load-test-artifact.json produced by the runner.
 */

const IR_PREFIX = 'LOAD_TEST_SPEC:';

export async function run({ dir }) {
  let artifact;
  try {
    artifact = JSON.parse(readFileSync(join(dir, 'load-test-artifact.json'), 'utf8'));
  } catch {
    return { pass: false, code: 'QA049', message: 'load-test-artifact.json not found — runner must produce it first' };
  }

  const required = ['ir_id', 'project', 'tool', 'scenarios', 'attestation'];
  const missing = required.filter(k => artifact[k] === undefined || artifact[k] === null);
  if (missing.length) {
    return { pass: false, code: 'QA049', message: `Artifact missing: ${missing.join(', ')}` };
  }

  if (!artifact.ir_id.startsWith(IR_PREFIX)) {
    return {
      pass: false, code: 'QA049',
      message: `ir_id must start with "${IR_PREFIX}", got: "${artifact.ir_id}"`,
    };
  }

  if (!artifact.attestation?.hash || artifact.attestation.hash.length < 32) {
    return { pass: false, code: 'QA049', message: 'Artifact attestation.hash missing or invalid' };
  }

  if (!Array.isArray(artifact.scenarios) || artifact.scenarios.length === 0) {
    return { pass: false, code: 'QA049', message: 'Artifact scenarios must be a non-empty array' };
  }

  return {
    pass: true, code: 'QA049',
    message: `Artifact valid — ${artifact.ir_id}, tool: ${artifact.tool}, ${artifact.scenarios.length} scenario(s)`,
  };
}
