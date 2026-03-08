import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'resilience-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'RR001', message: 'resilience-spec.json not found' };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'RR001', message: `Invalid JSON: ${e.message}` }; }

  if (!spec.errorBoundary && spec.errorBoundary !== false) {
    return { pass: false, code: 'RR001', message: 'spec.errorBoundary is required (true/false)' };
  }
  if (!spec.notFoundPath) {
    return { pass: false, code: 'RR001', message: 'spec.notFoundPath is required (e.g. "/404" or "*")' };
  }

  return { pass: true, code: 'RR001', message: `Spec valid — errorBoundary: ${spec.errorBoundary}, 404: ${spec.notFoundPath}` };
}
