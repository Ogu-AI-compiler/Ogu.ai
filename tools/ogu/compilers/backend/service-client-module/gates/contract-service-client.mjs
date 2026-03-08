import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const artifactPath = join(dir, 'service-client-artifact.json');
  if (!existsSync(artifactPath)) {
    return { pass: false, code: 'SC011', message: 'service-client-artifact.json not found — run compiler first' };
  }

  let artifact;
  try {
    artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'SC011', message: `service-client-artifact.json is not valid JSON: ${e.message}` };
  }

  const required = ['ir_id', 'provider', 'endpoints', 'auth', 'attestation'];
  const missing = required.filter(k => !(k in artifact));
  if (missing.length) {
    return { pass: false, code: 'SC011', message: `service-client-artifact.json missing fields: ${missing.join(', ')}` };
  }

  if (!artifact.ir_id.startsWith('SERVICE_CLIENT:')) {
    return { pass: false, code: 'SC011', message: `ir_id must be SERVICE_CLIENT:{provider}, got: "${artifact.ir_id}"` };
  }

  if (!Array.isArray(artifact.endpoints) || artifact.endpoints.length === 0) {
    return { pass: false, code: 'SC011', message: 'artifact.endpoints must be a non-empty array' };
  }

  if (!artifact.attestation?.hash) {
    return { pass: false, code: 'SC011', message: 'artifact.attestation.hash is missing' };
  }

  // Verify endpoints match spec
  const spec = JSON.parse(readFileSync(join(dir, 'service-client-spec.json'), 'utf8'));
  const specNames = new Set(spec.endpoints.map(e => e.name));
  const artifactNames = new Set(artifact.endpoints.map(e => e.name));
  for (const name of specNames) {
    if (!artifactNames.has(name)) {
      return { pass: false, code: 'SC011', message: `Spec endpoint "${name}" missing from artifact` };
    }
  }

  return {
    pass: true, code: 'SC011',
    message: `Service client contract valid — ${artifact.provider}, ${artifact.endpoints.length} endpoint(s)`
  };
}
