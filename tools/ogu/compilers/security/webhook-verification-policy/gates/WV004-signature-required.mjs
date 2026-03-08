import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** WV004 — signature-required: webhook signature verification must not be optional */
export async function run({ dir }) {
  const specPath = join(dir, 'webhook-verification-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'WV004', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'WV004', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!Array.isArray(spec.webhooks)) return { pass: true, code: 'WV004', message: 'No webhooks — gate skipped', skipped: true };

  const APPROVED_ALGOS = new Set(['hmac-sha256', 'hmac-sha512', 'rsa-sha256', 'ed25519', 'sha256', 'sha512']);
  const violations = [];

  for (const wh of spec.webhooks) {
    const id = wh.provider || '?';

    if (wh.signature_required === false || wh.signature_optional === true) {
      violations.push(`Webhook "${id}": signature verification must not be optional — every webhook must be verified`);
    }

    const algo = String(wh.signing_algorithm || '').toLowerCase().replace(/_/g, '-');
    if (!APPROVED_ALGOS.has(algo)) {
      violations.push(`Webhook "${id}": signing_algorithm "${wh.signing_algorithm}" is not approved — use hmac-sha256, hmac-sha512, rsa-sha256, or ed25519`);
    }

    if (!wh.secret_ref || typeof wh.secret_ref !== 'string') {
      violations.push(`Webhook "${id}": secret_ref must reference a key in the secret-handling-policy — do not hardcode the signing secret`);
    }
  }

  if (violations.length > 0) return { pass: false, code: 'WV004', message: `${violations.length} webhook(s) have signature verification issues`, detail: violations.join('\n') };
  return { pass: true, code: 'WV004', message: `Signature verification properly declared for all ${spec.webhooks.length} webhook(s)` };
}
