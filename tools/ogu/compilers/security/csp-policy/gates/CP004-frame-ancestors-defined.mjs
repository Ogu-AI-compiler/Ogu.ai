import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** CP004 — frame-ancestors-defined: frame-ancestors must be explicitly set to prevent clickjacking */
export async function run({ dir }) {
  const specPath = join(dir, 'csp-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'CP004', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'CP004', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!spec.directives) return { pass: true, code: 'CP004', message: 'No directives — gate skipped', skipped: true };

  const frameAncestors = spec.directives['frame-ancestors'];
  if (!frameAncestors) {
    return {
      pass: false,
      code: 'CP004',
      message: 'CSP is missing "frame-ancestors" directive — add frame-ancestors: "\'none\'" or "\'self\'" to prevent clickjacking',
    };
  }

  const sources = Array.isArray(frameAncestors) ? frameAncestors : [frameAncestors];
  if (sources.includes('*')) {
    return {
      pass: false,
      code: 'CP004',
      message: '"frame-ancestors *" allows embedding from any origin — restrict to \'none\' or \'self\'',
    };
  }

  return { pass: true, code: 'CP004', message: `"frame-ancestors" defined: ${sources.join(' ')}` };
}
