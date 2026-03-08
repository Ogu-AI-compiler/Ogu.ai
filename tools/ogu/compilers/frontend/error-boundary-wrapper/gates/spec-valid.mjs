import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'error-boundary-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'EB001', message: 'error-boundary-spec.json not found' };
  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); } catch { return { pass: false, code: 'EB001', message: 'error-boundary-spec.json is invalid JSON' }; }
  const required = ['component', 'fallback_component', 'scope'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) return { pass: false, code: 'EB001', message: `error-boundary-spec.json missing: ${missing.join(', ')}` };
  return { pass: true, code: 'EB001', message: `Spec valid: ${spec.component}` };
}
