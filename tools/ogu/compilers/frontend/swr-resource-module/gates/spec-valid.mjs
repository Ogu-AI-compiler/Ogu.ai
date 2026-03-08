import { readFileSync, existsSync } from 'fs'; import { join } from 'path';
export async function run({ dir }) {
  const specPath = join(dir, 'swr-resource-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'SW001', message: 'swr-resource-spec.json not found' };
  let spec; try { spec = JSON.parse(readFileSync(specPath, 'utf8')); } catch { return { pass: false, code: 'SW001', message: 'swr-resource-spec.json is invalid JSON' }; }
  const required = ['resource', 'key_pattern', 'revalidation'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) return { pass: false, code: 'SW001', message: `swr-resource-spec.json missing: ${missing.join(', ')}` };
  return { pass: true, code: 'SW001', message: `Spec valid: ${spec.resource}` };
}
