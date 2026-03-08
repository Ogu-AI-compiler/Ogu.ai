import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'mutation-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'MU001', message: 'mutation-spec.json not found' };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'MU001', message: `Invalid JSON: ${e.message}` };
  }

  const required = ['hookName', 'endpoint', 'method', 'payloadType'];
  const missing = required.filter(f => !spec[f]);
  if (missing.length) {
    return { pass: false, code: 'MU001', message: `Missing required fields: ${missing.join(', ')}` };
  }

  const writeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!writeMethods.includes(spec.method?.toUpperCase())) {
    return {
      pass: false, code: 'MU001',
      message: `mutation-module requires write methods (${writeMethods.join('/')}). Got: ${spec.method}. Use query-module for reads.`
    };
  }

  return { pass: true, code: 'MU001', message: `Spec valid — ${spec.method} ${spec.endpoint}` };
}
