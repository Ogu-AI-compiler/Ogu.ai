import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const artifactPath = join(dir, 'cache-artifact.json');
  if (!existsSync(artifactPath)) {
    return { pass: false, code: 'CA010', message: 'cache-artifact.json not found — run compiler first' };
  }

  let artifact;
  try {
    artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'CA010', message: `cache-artifact.json is not valid JSON: ${e.message}` };
  }

  const required = ['ir_id', 'family', 'namespace', 'pattern', 'keyInputs', 'attestation'];
  const missing = required.filter(k => !(k in artifact));
  if (missing.length) {
    return { pass: false, code: 'CA010', message: `cache-artifact.json missing fields: ${missing.join(', ')}` };
  }

  if (!artifact.ir_id.startsWith('CACHE:')) {
    return { pass: false, code: 'CA010', message: `ir_id must be CACHE:{namespace}, got: "${artifact.ir_id}"` };
  }

  if (!artifact.attestation?.hash) {
    return { pass: false, code: 'CA010', message: 'artifact.attestation.hash is missing' };
  }

  const spec = JSON.parse(readFileSync(join(dir, 'cache-spec.json'), 'utf8'));
  if (artifact.namespace !== spec.namespace) {
    return { pass: false, code: 'CA010', message: `artifact.namespace "${artifact.namespace}" does not match spec.namespace "${spec.namespace}"` };
  }

  return {
    pass: true, code: 'CA010',
    message: `Cache contract valid — ${artifact.family}/${artifact.namespace}, pattern: ${artifact.pattern}`
  };
}
