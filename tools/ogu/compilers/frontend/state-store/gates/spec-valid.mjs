import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'store-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'SS001', message: 'store-spec.json not found' };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'SS001', message: `Invalid JSON: ${e.message}` };
  }

  const required = ['name', 'engine', 'state'];
  const missing = required.filter(f => !spec[f]);
  if (missing.length) {
    return { pass: false, code: 'SS001', message: `Missing required fields: ${missing.join(', ')}` };
  }

  const engines = ['zustand', 'redux-toolkit', 'redux'];
  if (!engines.includes(spec.engine)) {
    return { pass: false, code: 'SS001', message: `engine must be one of: ${engines.join(', ')}. Got: ${spec.engine}` };
  }

  if (!spec.state || typeof spec.state !== 'object') {
    return { pass: false, code: 'SS001', message: 'state must be an object describing the store shape' };
  }

  return { pass: true, code: 'SS001', message: `Spec valid — ${spec.engine} store: ${spec.name}` };
}
