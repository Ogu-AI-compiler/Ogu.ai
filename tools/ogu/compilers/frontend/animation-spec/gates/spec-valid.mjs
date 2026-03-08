import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'animation-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'AN001', message: 'animation-spec.json not found' };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'AN001', message: `Invalid JSON: ${e.message}` };
  }

  const required = ['name', 'variants'];
  const missing = required.filter(f => !spec[f]);
  if (missing.length) {
    return { pass: false, code: 'AN001', message: `Missing required fields: ${missing.join(', ')}` };
  }

  if (typeof spec.variants !== 'object' || Array.isArray(spec.variants)) {
    return { pass: false, code: 'AN001', message: 'variants must be an object with named states (e.g. { hidden, visible, exit })' };
  }

  const engines = ['framer-motion', 'tailwind', 'css'];
  if (spec.engine && !engines.includes(spec.engine)) {
    return { pass: false, code: 'AN001', message: `engine must be one of: ${engines.join(', ')}` };
  }

  return { pass: true, code: 'AN001', message: `Spec valid — ${spec.name} (${Object.keys(spec.variants).length} variants, engine: ${spec.engine || 'framer-motion'})` };
}
