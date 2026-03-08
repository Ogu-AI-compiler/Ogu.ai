import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'flag-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'FF001', message: 'flag-spec.json not found' };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'FF001', message: `Invalid JSON: ${e.message}` }; }

  if (!spec.flags || !Array.isArray(spec.flags) || !spec.flags.length) {
    return { pass: false, code: 'FF001', message: 'spec.flags must be a non-empty array' };
  }

  const invalid = spec.flags.filter(f => !f.name || f.defaultValue === undefined);
  if (invalid.length) {
    return { pass: false, code: 'FF001', message: `Flags missing name or defaultValue: ${invalid.map(f => f.name || '(unnamed)').join(', ')}` };
  }

  return { pass: true, code: 'FF001', message: `Spec valid — ${spec.flags.length} flags defined` };
}
