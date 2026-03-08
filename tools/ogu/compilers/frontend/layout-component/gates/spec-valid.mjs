import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'layout-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'LC001', message: 'layout-spec.json not found' };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'LC001', message: `Invalid JSON: ${e.message}` }; }

  if (!spec.name) return { pass: false, code: 'LC001', message: "Missing required field: 'name'" };
  if (!spec.slots || !Array.isArray(spec.slots) || !spec.slots.length) {
    return { pass: false, code: 'LC001', message: "Missing 'slots' array — define layout regions (e.g. [\"header\", \"main\", \"footer\"])" };
  }

  const validSlots = ['header', 'sidebar', 'main', 'footer', 'aside', 'nav', 'toolbar', 'drawer'];
  const invalid = spec.slots.filter(s => !validSlots.includes(s));
  if (invalid.length) {
    return { pass: false, code: 'LC001', message: `Unknown slots: ${invalid.join(', ')}. Valid: ${validSlots.join(', ')}` };
  }

  if (!spec.slots.includes('main')) {
    return { pass: false, code: 'LC001', message: "Layout must include 'main' slot — it is the primary content area" };
  }

  return { pass: true, code: 'LC001', message: `Spec valid — ${spec.name} with slots: [${spec.slots.join(', ')}]` };
}
