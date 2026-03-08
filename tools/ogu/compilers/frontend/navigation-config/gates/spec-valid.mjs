import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'nav-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'NC001', message: 'nav-spec.json not found' };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'NC001', message: `Invalid JSON: ${e.message}` }; }

  if (!spec.items || !Array.isArray(spec.items) || !spec.items.length) {
    return { pass: false, code: 'NC001', message: 'spec.items must be a non-empty array of nav items' };
  }

  const invalid = spec.items.filter(item => !item.label || !item.path);
  if (invalid.length) {
    return { pass: false, code: 'NC001', message: `Nav items missing label or path: ${invalid.map(i => i.label || '(no label)').join(', ')}` };
  }

  return { pass: true, code: 'NC001', message: `Spec valid — ${spec.items.length} nav items` };
}
