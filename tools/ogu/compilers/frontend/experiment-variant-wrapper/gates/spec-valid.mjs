import { readFileSync, existsSync } from 'fs'; import { join } from 'path';
export async function run({ dir }) {
  const specPath = join(dir, 'experiment-variant-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'EV001', message: 'experiment-variant-spec.json not found' };
  let spec; try { spec = JSON.parse(readFileSync(specPath, 'utf8')); } catch { return { pass: false, code: 'EV001', message: 'experiment-variant-spec.json is invalid JSON' }; }
  const required = ['experiment_id', 'variants', 'fallback_variant'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) return { pass: false, code: 'EV001', message: `experiment-variant-spec.json missing: ${missing.join(', ')}` };
  if (!Array.isArray(spec.variants) || spec.variants.length < 2) return { pass: false, code: 'EV001', message: 'variants must be an array with at least 2 entries (control + treatment)' };
  if (!spec.variants.includes(spec.fallback_variant)) return { pass: false, code: 'EV001', message: `fallback_variant '${spec.fallback_variant}' must be in variants array` };
  return { pass: true, code: 'EV001', message: `Spec valid: ${spec.experiment_id}, ${spec.variants.length} variants` };
}
