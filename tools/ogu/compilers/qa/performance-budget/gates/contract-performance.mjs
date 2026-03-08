import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA037 — contract-performance
 * Validates the performance-budget-artifact.json produced by the runner.
 * Ensures structural integrity before downstream compilers consume it.
 */

const REQUIRED_TOP = ['ir_id', 'ciAction', 'attestation'];
const IR_PREFIX = 'PERFORMANCE_BUDGET:';

export async function run({ dir }) {
  let artifact;
  try {
    artifact = JSON.parse(readFileSync(join(dir, 'performance-budget-artifact.json'), 'utf8'));
  } catch {
    return { pass: false, code: 'QA037', message: 'performance-budget-artifact.json not found — runner must produce it first' };
  }

  // Required top-level fields
  const missing = REQUIRED_TOP.filter(k => artifact[k] === undefined || artifact[k] === null);
  if (missing.length) {
    return {
      pass: false, code: 'QA037',
      message: `Artifact missing required fields: ${missing.join(', ')}`,
    };
  }

  // ir_id prefix
  if (!artifact.ir_id.startsWith(IR_PREFIX)) {
    return {
      pass: false, code: 'QA037',
      message: `ir_id must start with "${IR_PREFIX}", got: "${artifact.ir_id}"`,
    };
  }

  // attestation hash
  if (!artifact.attestation?.hash || typeof artifact.attestation.hash !== 'string' || artifact.attestation.hash.length < 32) {
    return {
      pass: false, code: 'QA037',
      message: 'Artifact attestation.hash is missing or too short (must be SHA-256 hex)',
    };
  }

  // ciAction must be present and not "none"
  if (!artifact.ciAction || artifact.ciAction === 'none') {
    return {
      pass: false, code: 'QA037',
      message: `Artifact ciAction is "${artifact.ciAction}" — enforced CI action required`,
    };
  }

  // If coreWebVitals declared, must have at least one metric
  if (artifact.coreWebVitals !== undefined) {
    if (typeof artifact.coreWebVitals !== 'object' || Array.isArray(artifact.coreWebVitals)) {
      return { pass: false, code: 'QA037', message: 'Artifact coreWebVitals must be an object' };
    }
    if (Object.keys(artifact.coreWebVitals).length === 0) {
      return { pass: false, code: 'QA037', message: 'Artifact coreWebVitals is declared but empty' };
    }
  }

  const metrics = artifact.coreWebVitals ? Object.keys(artifact.coreWebVitals).join(', ') : 'none declared';
  return {
    pass: true, code: 'QA037',
    message: `Artifact valid — ir_id: ${artifact.ir_id}, ciAction: ${artifact.ciAction}, metrics: ${metrics}`,
  };
}
