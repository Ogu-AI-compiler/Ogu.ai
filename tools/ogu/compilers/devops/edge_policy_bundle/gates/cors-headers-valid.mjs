/**
 * Gate: cors-headers-valid (EP003)
 * Validates the CORS configuration. A wildcard allowedOrigins combined with
 * allowCredentials is a security misconfiguration — browsers reject credential
 * requests to wildcard origins (CORS spec prohibits this combination).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']);

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'edge-policy-spec.json'), 'utf8'));

  if (!spec.cors) {
    return { pass: true, code: 'EP003', message: 'No CORS config — skipping', skipped: true };
  }

  const { cors }    = spec;
  const violations  = [];

  if (!cors.allowedOrigins || cors.allowedOrigins.length === 0) {
    violations.push({ field: 'cors.allowedOrigins', reason: 'allowedOrigins must be a non-empty array', hint: 'List allowed origins explicitly, or use ["*"] for public APIs (without allowCredentials)' });
  }
  if (cors.allowedOrigins?.includes('*') && cors.allowCredentials) {
    violations.push({ field: 'cors', reason: 'allowedOrigins=["*"] is incompatible with allowCredentials=true — browsers will block credential requests', hint: 'List specific allowed origins instead of using "*" when allowCredentials is true' });
  }
  if (cors.allowedMethods) {
    for (const m of cors.allowedMethods) {
      if (!ALLOWED_METHODS.has(m.toUpperCase())) {
        violations.push({ field: 'cors.allowedMethods', method: m, allowed: [...ALLOWED_METHODS], reason: `Unknown HTTP method "${m}"` });
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'EP003',
      message: `${violations.length} CORS configuration error(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'EP003', message: 'CORS headers config valid' };
}
