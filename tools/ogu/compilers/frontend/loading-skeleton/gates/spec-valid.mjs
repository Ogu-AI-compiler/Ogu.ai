import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'skeleton-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'SK001', message: 'skeleton-spec.json not found' };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'SK001', message: `Invalid JSON: ${e.message}` };
  }

  const required = ['componentName', 'shape'];
  const missing = required.filter(f => !spec[f]);
  if (missing.length) {
    return { pass: false, code: 'SK001', message: `Missing required fields: ${missing.join(', ')}` };
  }

  const validShapes = ['list', 'card', 'table', 'form', 'profile', 'article', 'grid', 'custom'];
  if (!validShapes.includes(spec.shape)) {
    return { pass: false, code: 'SK001', message: `shape must be one of: ${validShapes.join(', ')}. Got: ${spec.shape}` };
  }

  return { pass: true, code: 'SK001', message: `Spec valid — ${spec.componentName} skeleton (${spec.shape})` };
}
