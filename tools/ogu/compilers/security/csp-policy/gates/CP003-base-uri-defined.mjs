import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** CP003 — base-uri-defined: base-uri must be explicitly defined, not left to browser default */
export async function run({ dir }) {
  const specPath = join(dir, 'csp-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'CP003', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'CP003', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!spec.directives) return { pass: true, code: 'CP003', message: 'No directives — gate skipped', skipped: true };

  const baseUri = spec.directives['base-uri'];
  if (!baseUri) {
    return {
      pass: false,
      code: 'CP003',
      message: 'CSP is missing "base-uri" directive — add base-uri: "\'self\'" to prevent base-tag injection attacks',
    };
  }

  const sources = Array.isArray(baseUri) ? baseUri : [baseUri];
  if (sources.includes('*') || sources.includes('null')) {
    return {
      pass: false,
      code: 'CP003',
      message: `"base-uri" is set to "${sources.join(' ')}" — must be "'self'" or a specific origin, not wildcard or null`,
    };
  }

  return { pass: true, code: 'CP003', message: `"base-uri" is explicitly defined: ${sources.join(' ')}` };
}
