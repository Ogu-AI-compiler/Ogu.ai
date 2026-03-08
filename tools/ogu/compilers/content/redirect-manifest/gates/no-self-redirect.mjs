import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** RDR005 — no-self-redirect: from and to URLs must be different */
export async function run({ dir }) {
  const specPath = join(dir, 'redirect-manifest.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'RDR005', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'RDR005', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.redirects) || spec.redirects.length === 0) {
    return { pass: true, code: 'RDR005', message: 'No redirects defined — gate skipped', skipped: true };
  }

  const violations = [];

  for (const r of spec.redirects) {
    if (!r.from || !r.to) continue;
    // Normalize trailing slashes for comparison
    const from = r.from.replace(/\/$/, '');
    const to   = r.to.replace(/\/$/, '');
    if (from === to) {
      violations.push(`Self-redirect: "${r.from}" → "${r.to}"`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'RDR005',
      message: `${violations.length} self-redirect(s) detected`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'RDR005',
    message: `No self-redirects in ${spec.redirects.length} redirect(s)`,
  };
}
