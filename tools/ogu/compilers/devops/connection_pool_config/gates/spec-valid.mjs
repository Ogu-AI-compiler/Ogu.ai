/**
 * Gate: spec-valid (CP001)
 * Validates that connection-pool-spec.json exists, is valid JSON, and declares
 * all required fields. Missing fields cause downstream gates (limits, host
 * resolution, client connection sufficiency) to fail with misleading errors.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REQUIRED = ['pooler', 'maxClientConn', 'poolSize', 'host'];

export async function run({ dir }) {
  const specPath = join(dir, 'connection-pool-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'CP001',
      message: 'connection-pool-spec.json not found',
      detail: { searched: specPath, hint: 'Create connection-pool-spec.json with pooler, maxClientConn, poolSize, and host fields' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'CP001', message: `connection-pool-spec.json is not valid JSON: ${e.message}` };
  }

  const missing = REQUIRED.filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'CP001',
      message: `connection-pool-spec.json missing required field(s): ${missing.join(', ')}`,
      detail: { missing, required: REQUIRED },
    };
  }

  return { pass: true, code: 'CP001', message: `connection-pool-spec.json valid — pooler: ${spec.pooler}` };
}
