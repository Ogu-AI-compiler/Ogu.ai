import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** WV006 — tls-required: all webhook endpoints must require HTTPS — plaintext HTTP webhooks leak payloads and bypass signature checks */
export async function run({ dir }) {
  const specPath = join(dir, 'webhook-spec.json');
  if (!existsSync(specPath)) return { pass: true, code: 'WV006', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'WV006', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!Array.isArray(spec.endpoints) || spec.endpoints.length === 0) {
    return { pass: true, code: 'WV006', message: 'No endpoints declared — gate skipped', skipped: true };
  }

  const violations = [];
  for (const ep of spec.endpoints) {
    const url = ep.url || ep.path || '';
    const id = ep.id || url || '?';

    if (url.startsWith('http://')) {
      violations.push(`Endpoint "${id}": URL uses http:// — webhook receivers must use HTTPS to protect payloads in transit`);
    } else if (ep.tls_required === false || ep.require_tls === false) {
      violations.push(`Endpoint "${id}": TLS is explicitly disabled — all webhook endpoints must enforce TLS`);
    }
  }

  // Also check global policy
  if (spec.require_tls === false || spec.tls_required === false) {
    violations.push('Global policy: TLS is disabled — set require_tls: true for all webhook endpoints');
  }

  if (violations.length > 0) {
    return { pass: false, code: 'WV006', message: `${violations.length} webhook endpoint(s) do not require TLS`, detail: violations.join('\n') };
  }
  return { pass: true, code: 'WV006', message: `TLS enforced for all ${spec.endpoints.length} webhook endpoint(s)` };
}
