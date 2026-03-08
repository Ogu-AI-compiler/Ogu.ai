import { readFileSync, existsSync } from 'fs'; import { join } from 'path';
export async function run({ dir }) {
  const specPath = join(dir, 'a11y-harness-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'AH001', message: 'a11y-harness-spec.json not found' };
  let spec; try { spec = JSON.parse(readFileSync(specPath, 'utf8')); } catch { return { pass: false, code: 'AH001', message: 'a11y-harness-spec.json is invalid JSON' }; }
  const required = ['wcag_level', 'components_under_test', 'axe_rules'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) return { pass: false, code: 'AH001', message: `a11y-harness-spec.json missing: ${missing.join(', ')}` };
  if (!['A', 'AA', 'AAA'].includes(spec.wcag_level)) return { pass: false, code: 'AH001', message: `wcag_level must be A, AA, or AAA — got: ${spec.wcag_level}` };
  return { pass: true, code: 'AH001', message: `Spec valid: WCAG ${spec.wcag_level}, ${spec.components_under_test?.length || 0} components` };
}
