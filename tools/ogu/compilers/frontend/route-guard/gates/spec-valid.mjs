import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'guard-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'RG001', message: 'guard-spec.json not found' };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'RG001', message: `Invalid JSON: ${e.message}` }; }

  const required = ['name', 'redirectTo', 'authHook'];
  const missing = required.filter(f => !spec[f]);
  if (missing.length) return { pass: false, code: 'RG001', message: `Missing: ${missing.join(', ')}` };

  if (!spec.redirectTo.startsWith('/')) {
    return { pass: false, code: 'RG001', message: `redirectTo must be an absolute path (e.g. "/login"). Got: ${spec.redirectTo}` };
  }

  return { pass: true, code: 'RG001', message: `Spec valid — ${spec.name}, redirects to ${spec.redirectTo}` };
}
