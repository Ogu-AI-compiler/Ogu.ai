import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'searchparams-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'USP001', message: 'searchparams-spec.json not found' };
  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'USP001', message: `Invalid JSON: ${e.message}` }; }
  if (!spec.params || !Array.isArray(spec.params) || !spec.params.length)
    return { pass: false, code: 'USP001', message: 'spec.params must be a non-empty array' };
  const invalid = spec.params.filter(p => !p.name || !p.type);
  if (invalid.length) return { pass: false, code: 'USP001', message: `Params missing name or type: ${invalid.map(p => p.name || '?').join(', ')}` };
  return { pass: true, code: 'USP001', message: `Spec valid — ${spec.params.length} params defined` };
}
