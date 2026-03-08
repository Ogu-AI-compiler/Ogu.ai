import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA066 — contract-visual
 * Validates the visual-regression-artifact.json produced by the runner.
 */

const IR_PREFIX = 'VISUAL_REGRESSION:';

export async function run({ dir }) {
  let artifact;
  try {
    artifact = JSON.parse(readFileSync(join(dir, 'visual-regression-artifact.json'), 'utf8'));
  } catch {
    return { pass: false, code: 'QA066', message: 'visual-regression-artifact.json not found — runner must produce it first' };
  }

  const required = ['ir_id', 'tool', 'viewports', 'diffThreshold', 'attestation'];
  const missing = required.filter(k => artifact[k] === undefined || artifact[k] === null);
  if (missing.length) {
    return { pass: false, code: 'QA066', message: `Artifact missing: ${missing.join(', ')}` };
  }

  if (!artifact.ir_id.startsWith(IR_PREFIX)) {
    return {
      pass: false, code: 'QA066',
      message: `ir_id must start with "${IR_PREFIX}", got: "${artifact.ir_id}"`,
    };
  }

  if (!artifact.attestation?.hash || artifact.attestation.hash.length < 32) {
    return { pass: false, code: 'QA066', message: 'Artifact attestation.hash missing or invalid' };
  }

  if (!Array.isArray(artifact.viewports) || artifact.viewports.length === 0) {
    return { pass: false, code: 'QA066', message: 'Artifact viewports must be a non-empty array' };
  }

  if (typeof artifact.diffThreshold !== 'number') {
    return { pass: false, code: 'QA066', message: 'Artifact diffThreshold must be a number' };
  }

  return {
    pass: true, code: 'QA066',
    message: `Artifact valid — ${artifact.ir_id}, ${artifact.viewports.length} viewport(s), threshold: ${artifact.diffThreshold}`,
  };
}
