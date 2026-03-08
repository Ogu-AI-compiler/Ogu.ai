import { readFileSync, existsSync } from 'fs'; import { join } from 'path';
export async function run({ dir }) {
  const specPath = join(dir, 'storybook-harness-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'SBC001', message: 'storybook-harness-spec.json not found' };
  let spec; try { spec = JSON.parse(readFileSync(specPath, 'utf8')); } catch { return { pass: false, code: 'SBC001', message: 'storybook-harness-spec.json is invalid JSON' }; }
  const required = ['framework', 'addons', 'stories_glob'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) return { pass: false, code: 'SBC001', message: `storybook-harness-spec.json missing: ${missing.join(', ')}` };
  return { pass: true, code: 'SBC001', message: `Spec valid: ${spec.framework}, ${spec.addons?.length || 0} addons` };
}
