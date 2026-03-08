import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'a11y-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'A1001', message: 'a11y-spec.json not found' };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'A1001', message: `Invalid JSON: ${e.message}` }; }

  if (!spec.component) return { pass: false, code: 'A1001', message: 'spec.component is required' };
  if (!spec.wcagLevel || !['A', 'AA', 'AAA'].includes(spec.wcagLevel)) {
    return { pass: false, code: 'A1001', message: 'spec.wcagLevel must be A, AA, or AAA' };
  }

  return { pass: true, code: 'A1001', message: `Spec valid — component: ${spec.component}, WCAG ${spec.wcagLevel}` };
}
