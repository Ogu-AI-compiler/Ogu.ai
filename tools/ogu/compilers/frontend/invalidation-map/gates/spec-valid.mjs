import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'invalidation-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'IV001', message: 'invalidation-spec.json not found' };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'IV001', message: `Invalid JSON: ${e.message}` }; }

  if (!spec.map || typeof spec.map !== 'object') {
    return { pass: false, code: 'IV001', message: 'spec.map required — object mapping mutation names to arrays of query keys they invalidate' };
  }

  const errors = [];
  for (const [mutation, queries] of Object.entries(spec.map)) {
    if (!Array.isArray(queries)) errors.push(`'${mutation}': value must be an array of query keys`);
  }

  if (errors.length) return { pass: false, code: 'IV001', message: 'Map structure errors', detail: errors.join('\n') };

  const totalLinks = Object.values(spec.map).reduce((s, q) => s + q.length, 0);
  return { pass: true, code: 'IV001', message: `Spec valid — ${Object.keys(spec.map).length} mutations, ${totalLinks} invalidation links` };
}
