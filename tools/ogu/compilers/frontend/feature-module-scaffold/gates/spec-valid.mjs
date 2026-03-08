import { readFileSync, existsSync } from 'fs'; import { join } from 'path';
export async function run({ dir }) {
  const specPath = join(dir, 'feature-module-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'FM001', message: 'feature-module-spec.json not found' };
  let spec; try { spec = JSON.parse(readFileSync(specPath, 'utf8')); } catch { return { pass: false, code: 'FM001', message: 'feature-module-spec.json is invalid JSON' }; }
  const required = ['feature_name', 'capabilities', 'public_api'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) return { pass: false, code: 'FM001', message: `feature-module-spec.json missing: ${missing.join(', ')}` };
  if (!Array.isArray(spec.capabilities) || !spec.capabilities.length) return { pass: false, code: 'FM001', message: 'capabilities must be a non-empty array' };
  return { pass: true, code: 'FM001', message: `Spec valid: ${spec.feature_name}, ${spec.capabilities.length} capabilities` };
}
