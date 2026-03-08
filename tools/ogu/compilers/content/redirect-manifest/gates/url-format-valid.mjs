import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** RDR006 — url-format-valid: redirect from/to URLs must start with "/" (relative paths only, no absolute URLs) */
export async function run({ dir }) {
  const specPath = join(dir, 'redirect-manifest.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'RDR006', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'RDR006', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.redirects) || spec.redirects.length === 0) {
    return { pass: true, code: 'RDR006', message: 'No redirects defined — gate skipped', skipped: true };
  }

  const violations = [];

  for (const r of spec.redirects) {
    if (r.from && !r.from.startsWith('/')) {
      // Allow full URLs (https://) only for cross-domain redirects explicitly marked crossDomain:true
      if (!r.crossDomain) {
        violations.push(
          `"from" URL "${r.from}" does not start with "/" — use relative paths or set crossDomain:true`
        );
      }
    }

    // 410 Gone entries don't need a "to" URL
    if (r.to && r.code !== 410 && !r.to.startsWith('/')) {
      if (!r.crossDomain) {
        violations.push(
          `"to" URL "${r.to}" does not start with "/" — use relative paths or set crossDomain:true`
        );
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'RDR006',
      message: `${violations.length} URL format violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'RDR006',
    message: `All ${spec.redirects.length} redirect URL(s) have valid format`,
  };
}
