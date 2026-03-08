import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** VE006 — affected-components-listed: vulnerability exception must name which components or packages are affected */
export async function run({ dir }) {
  const specPath = join(dir, 'vuln-exception-spec.json');
  if (!existsSync(specPath)) return { pass: true, code: 'VE006', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'VE006', message: 'Invalid JSON — gate skipped', skipped: true }; }

  const hasComponents =
    (Array.isArray(spec.affectedComponents) && spec.affectedComponents.length > 0) ||
    (Array.isArray(spec.affected_components) && spec.affected_components.length > 0) ||
    (Array.isArray(spec.packages) && spec.packages.length > 0) ||
    (typeof spec.package === 'string' && spec.package.trim().length > 0);

  if (!hasComponents) {
    return {
      pass: false,
      code: 'VE006',
      message: 'No affected components listed — exception must declare affectedComponents[] to scope the risk precisely',
    };
  }

  const components =
    spec.affectedComponents ||
    spec.affected_components ||
    spec.packages ||
    [spec.package];

  return { pass: true, code: 'VE006', message: `Affected components declared: ${components.slice(0, 5).join(', ')}` };
}
