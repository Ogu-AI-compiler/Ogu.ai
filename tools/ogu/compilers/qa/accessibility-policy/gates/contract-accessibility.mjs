import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA077 — contract-accessibility
 * Validates the accessibility-policy-artifact.json produced by the runner.
 */

const IR_PREFIX = 'ACCESSIBILITY_POLICY:';

export async function run({ dir }) {
  let artifact;
  try {
    artifact = JSON.parse(readFileSync(join(dir, 'accessibility-policy-artifact.json'), 'utf8'));
  } catch {
    return { pass: false, code: 'QA077', message: 'accessibility-policy-artifact.json not found — runner must produce it first' };
  }

  const required = ['ir_id', 'tool', 'wcagVersion', 'wcagLevel', 'attestation'];
  const missing = required.filter(k => artifact[k] === undefined || artifact[k] === null);
  if (missing.length) {
    return { pass: false, code: 'QA077', message: `Artifact missing: ${missing.join(', ')}` };
  }

  if (!artifact.ir_id.startsWith(IR_PREFIX)) {
    return {
      pass: false, code: 'QA077',
      message: `ir_id must start with "${IR_PREFIX}", got: "${artifact.ir_id}"`,
    };
  }

  if (!artifact.attestation?.hash || artifact.attestation.hash.length < 32) {
    return { pass: false, code: 'QA077', message: 'Artifact attestation.hash missing or invalid' };
  }

  return {
    pass: true, code: 'QA077',
    message: `Artifact valid — ${artifact.ir_id}, WCAG ${artifact.wcagVersion} Level ${artifact.wcagLevel}`,
  };
}
