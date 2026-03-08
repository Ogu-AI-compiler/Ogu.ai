import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * TX008 — contract-transaction
 * Validates the compiled output against the transaction contract:
 * - transaction-artifact.json must exist
 * - artifact must have ir_id, name, writes[], orm fields
 * - all writes referenced in artifact must appear in the spec
 */

export async function run({ dir }) {
  const artifactPath = join(dir, 'transaction-artifact.json');
  if (!existsSync(artifactPath)) {
    return { pass: false, code: 'TX008', message: 'transaction-artifact.json not found — run compiler first' };
  }

  let artifact;
  try {
    artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'TX008', message: `transaction-artifact.json is not valid JSON: ${e.message}` };
  }

  const required = ['ir_id', 'name', 'writes', 'orm', 'attestation'];
  const missing = required.filter(k => !(k in artifact));
  if (missing.length) {
    return { pass: false, code: 'TX008', message: `transaction-artifact.json missing fields: ${missing.join(', ')}` };
  }

  if (!artifact.ir_id.startsWith('TRANSACTION:')) {
    return { pass: false, code: 'TX008', message: `ir_id must be TRANSACTION:{name}, got: "${artifact.ir_id}"` };
  }

  if (!Array.isArray(artifact.writes) || artifact.writes.length < 2) {
    return { pass: false, code: 'TX008', message: 'artifact.writes must have ≥2 entries' };
  }

  const specPath = join(dir, 'transaction-spec.json');
  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: false, code: 'TX008', message: 'transaction-spec.json not readable — cannot verify contract' };
  }

  const specWrites = new Set((spec.writes || []).map(w => w.model || w));
  for (const w of artifact.writes) {
    if (!specWrites.has(w)) {
      return {
        pass: false, code: 'TX008',
        message: `artifact.writes includes "${w}" not declared in spec.writes`,
        detail: `Spec writes: ${[...specWrites].join(', ')}`
      };
    }
  }

  if (!artifact.attestation?.hash) {
    return { pass: false, code: 'TX008', message: 'artifact.attestation.hash is missing' };
  }

  return {
    pass: true, code: 'TX008',
    message: `Transaction contract valid — ${artifact.name}, ${artifact.writes.length} writes, orm: ${artifact.orm}`
  };
}
