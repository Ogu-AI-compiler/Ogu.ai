import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'query-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'QM001', message: 'query-spec.json not found' };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'QM001', message: `Invalid JSON: ${e.message}` };
  }

  const required = ['hookName', 'endpoint', 'method', 'responseType'];
  const missing = required.filter(f => !spec[f]);
  if (missing.length) {
    return { pass: false, code: 'QM001', message: `Missing required fields: ${missing.join(', ')}` };
  }

  if (!['GET', 'HEAD'].includes(spec.method?.toUpperCase())) {
    return {
      pass: false, code: 'QM001',
      message: `query-module is for read-only methods (GET/HEAD). Got: ${spec.method}. Use mutation-module for writes.`
    };
  }

  return { pass: true, code: 'QM001', message: 'Spec valid' };
}
