import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** CP005 — no-wildcard-sources: connect-src, img-src, style-src must not use bare wildcard */
export async function run({ dir }) {
  const specPath = join(dir, 'csp-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'CP005', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'CP005', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!spec.directives) return { pass: true, code: 'CP005', message: 'No directives — gate skipped', skipped: true };

  const CHECK_DIRECTIVES = ['connect-src', 'img-src', 'style-src', 'font-src', 'object-src', 'media-src'];
  const violations = [];

  for (const directive of CHECK_DIRECTIVES) {
    const value = spec.directives[directive];
    if (!value) continue;
    const sources = Array.isArray(value) ? value : [value];
    if (sources.includes('*')) {
      // Allow wildcard img-src only if explicitly documented
      if (directive === 'img-src' && spec.wildcard_img_src_ok === true) continue;
      violations.push(`"${directive}" uses bare wildcard "*" — enumerate specific allowed origins instead`);
    }
  }

  if (violations.length > 0) return { pass: false, code: 'CP005', message: `${violations.length} directive(s) use wildcard source`, detail: violations.join('\n') };
  return { pass: true, code: 'CP005', message: 'No bare wildcard sources in CSP directives' };
}
