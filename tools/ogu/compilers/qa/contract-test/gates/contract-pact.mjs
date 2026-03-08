import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA057 — contract-pact
 * Validates the contract-test-artifact.json produced by the runner.
 */

const IR_PREFIX = 'CONTRACT_TEST:';

export async function run({ dir }) {
  let artifact;
  try {
    artifact = JSON.parse(readFileSync(join(dir, 'contract-test-artifact.json'), 'utf8'));
  } catch {
    return { pass: false, code: 'QA057', message: 'contract-test-artifact.json not found — runner must produce it first' };
  }

  const required = ['ir_id', 'framework', 'consumer', 'providers', 'interactions', 'attestation'];
  const missing = required.filter(k => artifact[k] === undefined || artifact[k] === null);
  if (missing.length) {
    return { pass: false, code: 'QA057', message: `Artifact missing: ${missing.join(', ')}` };
  }

  if (!artifact.ir_id.startsWith(IR_PREFIX)) {
    return {
      pass: false, code: 'QA057',
      message: `ir_id must start with "${IR_PREFIX}", got: "${artifact.ir_id}"`,
    };
  }

  if (!artifact.attestation?.hash || artifact.attestation.hash.length < 32) {
    return { pass: false, code: 'QA057', message: 'Artifact attestation.hash missing or invalid' };
  }

  if (!Array.isArray(artifact.providers) || artifact.providers.length === 0) {
    return { pass: false, code: 'QA057', message: 'Artifact providers must be a non-empty array' };
  }

  if (!Array.isArray(artifact.interactions) || artifact.interactions.length === 0) {
    return { pass: false, code: 'QA057', message: 'Artifact interactions must be a non-empty array' };
  }

  return {
    pass: true, code: 'QA057',
    message: `Artifact valid — ${artifact.ir_id}, ${artifact.providers.length} provider(s), ${artifact.interactions.length} interaction(s)`,
  };
}
