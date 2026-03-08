import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** RL006 — retry-after-header-defined: 429 responses must include a Retry-After header so clients can back off correctly */
export async function run({ dir }) {
  const specPath = join(dir, 'rate-limit-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'RL006', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'RL006', message: 'Invalid JSON — gate skipped', skipped: true }; }

  // Check top-level retry_after_header flag or per-endpoint declarations
  const globallyDefined =
    spec.retry_after_header === true ||
    spec.include_retry_after === true ||
    (spec.response_headers && spec.response_headers['Retry-After'] !== undefined);

  if (globallyDefined) {
    return { pass: true, code: 'RL006', message: 'Retry-After header declared globally' };
  }

  if (!Array.isArray(spec.endpoints)) {
    return { pass: false, code: 'RL006', message: 'Retry-After header not declared — set retry_after_header: true or declare it per endpoint' };
  }

  const violations = [];
  for (const ep of spec.endpoints) {
    const id = `${ep.method} ${ep.path}`;
    const hasRetryAfter =
      ep.retry_after_header === true ||
      ep.include_retry_after === true ||
      (ep.response_headers && ep.response_headers['Retry-After'] !== undefined);

    if (!hasRetryAfter) {
      violations.push(`Endpoint "${id}": missing retry_after_header — 429 responses must include Retry-After so clients know when to retry`);
    }
  }

  if (violations.length > 0) {
    return { pass: false, code: 'RL006', message: `${violations.length} endpoint(s) missing Retry-After header declaration`, detail: violations.join('\n') };
  }
  return { pass: true, code: 'RL006', message: `Retry-After header declared for all ${spec.endpoints.length} endpoint(s)` };
}
