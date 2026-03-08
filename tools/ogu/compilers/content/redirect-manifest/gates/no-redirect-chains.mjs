import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** RDR003 — no-redirect-chains: no A→B→C chains (redirect destination must not itself be redirected) */
export async function run({ dir }) {
  const specPath = join(dir, 'redirect-manifest.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'RDR003', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'RDR003', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.redirects) || spec.redirects.length === 0) {
    return { pass: true, code: 'RDR003', message: 'No redirects defined — gate skipped', skipped: true };
  }

  // Build set of all "from" URLs — these are the chained targets
  const fromUrls = new Set(spec.redirects.map(r => r.from).filter(Boolean));
  const violations = [];

  for (const r of spec.redirects) {
    if (!r.from || !r.to) continue;

    // If the destination is itself a source of another redirect, it's a chain
    if (fromUrls.has(r.to)) {
      violations.push(`Redirect chain: "${r.from}" → "${r.to}" (and "${r.to}" is also redirected)`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'RDR003',
      message: `${violations.length} redirect chain(s) detected`,
      detail: [
        ...violations.slice(0, 10),
        violations.length > 10 ? `...and ${violations.length - 10} more` : '',
      ].filter(Boolean).join('\n'),
    };
  }

  return {
    pass: true,
    code: 'RDR003',
    message: `No redirect chains in ${spec.redirects.length} redirect(s)`,
  };
}
