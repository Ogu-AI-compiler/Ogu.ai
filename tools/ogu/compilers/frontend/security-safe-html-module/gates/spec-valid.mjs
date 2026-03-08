import { readFileSync, existsSync } from 'fs'; import { join } from 'path';
export async function run({ dir }) {
  const specPath = join(dir, 'safe-html-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'SH001', message: 'safe-html-spec.json not found' };
  let spec; try { spec = JSON.parse(readFileSync(specPath, 'utf8')); } catch { return { pass: false, code: 'SH001', message: 'safe-html-spec.json is invalid JSON' }; }
  const required = ['component', 'allowed_tags', 'sanitizer'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) return { pass: false, code: 'SH001', message: `safe-html-spec.json missing: ${missing.join(', ')}` };
  if (!Array.isArray(spec.allowed_tags)) return { pass: false, code: 'SH001', message: 'allowed_tags must be an array' };
  return { pass: true, code: 'SH001', message: `Spec valid: ${spec.component}, sanitizer: ${spec.sanitizer}` };
}
