import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** CP002 — no-unsafe-inline-without-nonce: script-src must not contain unsafe-inline unless a nonce is used */
export async function run({ dir }) {
  const specPath = join(dir, 'csp-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'CP002', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'CP002', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!spec.directives) return { pass: true, code: 'CP002', message: 'No directives — gate skipped', skipped: true };

  const violations = [];
  const scriptSrc = spec.directives['script-src'];
  const defaultSrc = spec.directives['default-src'];

  function checkForUnsafeInline(directiveName, value) {
    if (!value) return;
    const sources = Array.isArray(value) ? value : [value];
    const hasUnsafeInline = sources.some(s => String(s).includes("'unsafe-inline'") || s === 'unsafe-inline');
    if (!hasUnsafeInline) return;

    const hasNonce = spec.nonce_strategy === true ||
      spec.nonce_enabled === true ||
      sources.some(s => String(s).startsWith("'nonce-") || String(s).startsWith("'sha"));

    if (!hasNonce) {
      violations.push(`"${directiveName}" contains 'unsafe-inline' without a nonce or hash strategy — set nonce_strategy: true or replace with 'nonce-{random}' or hash-based sources`);
    }
  }

  checkForUnsafeInline('script-src', scriptSrc);
  if (!scriptSrc) checkForUnsafeInline('default-src (fallback for script-src)', defaultSrc);

  // unsafe-eval is also dangerous
  const checkSrc = scriptSrc || defaultSrc;
  if (checkSrc) {
    const sources = Array.isArray(checkSrc) ? checkSrc : [checkSrc];
    if (sources.some(s => String(s).includes("'unsafe-eval'"))) {
      violations.push('"script-src" contains \'unsafe-eval\' — eval() enables XSS; remove this directive');
    }
  }

  if (violations.length > 0) return { pass: false, code: 'CP002', message: `${violations.length} unsafe CSP directive(s) found`, detail: violations.join('\n') };
  return { pass: true, code: 'CP002', message: 'No unsafe-inline without nonce in script-src' };
}
