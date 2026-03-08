import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'utility-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'UF001', message: 'utility-spec.json not found' };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'UF001', message: `Invalid JSON: ${e.message}` }; }

  const required = ['name', 'input', 'output', 'description'];
  const missing = required.filter(f => !spec[f]);
  if (missing.length) return { pass: false, code: 'UF001', message: `Missing required fields: ${missing.join(', ')}` };

  if (spec.hasSideEffects === true) {
    return { pass: false, code: 'UF001', message: "spec.hasSideEffects: true — use a different compiler. utility-fn is for pure functions only" };
  }

  return { pass: true, code: 'UF001', message: `Spec valid — ${spec.name}(${spec.input}) => ${spec.output}` };
}
