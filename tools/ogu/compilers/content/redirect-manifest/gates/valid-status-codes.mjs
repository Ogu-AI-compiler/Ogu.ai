import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** RDR004 — valid-status-codes: redirect codes must be 301, 302, or 410 only */
const VALID_CODES = new Set([301, 302, 410]);

export async function run({ dir }) {
  const specPath = join(dir, 'redirect-manifest.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'RDR004', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'RDR004', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.redirects) || spec.redirects.length === 0) {
    return { pass: true, code: 'RDR004', message: 'No redirects defined — gate skipped', skipped: true };
  }

  const violations = [];

  for (const r of spec.redirects) {
    if (!r.from) continue;

    if (r.code === undefined) {
      violations.push(`"${r.from}": missing status code (must be 301, 302, or 410)`);
      continue;
    }

    if (!VALID_CODES.has(r.code)) {
      violations.push(
        `"${r.from}": invalid status code ${r.code}. ` +
        `Allowed: 301 (permanent), 302 (temporary), 410 (gone)`
      );
    }

    // 410 Gone should not have a "to" destination
    if (r.code === 410 && r.to) {
      violations.push(
        `"${r.from}": 410 Gone redirects must not have a "to" destination`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'RDR004',
      message: `${violations.length} invalid redirect status code(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'RDR004',
    message: `All ${spec.redirects.length} redirect(s) have valid status codes`,
  };
}
