import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'analytics-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'AE001', message: 'analytics-spec.json not found' };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'AE001', message: `Invalid JSON: ${e.message}` }; }

  if (!spec.events || !Array.isArray(spec.events) || !spec.events.length) {
    return { pass: false, code: 'AE001', message: 'spec.events must be a non-empty array' };
  }

  const invalid = spec.events.filter(e => !e.name || !e.properties);
  if (invalid.length) {
    return { pass: false, code: 'AE001', message: `Events missing name or properties: ${invalid.map(e => e.name || '(unnamed)').join(', ')}` };
  }

  return { pass: true, code: 'AE001', message: `Spec valid — ${spec.events.length} events defined` };
}
