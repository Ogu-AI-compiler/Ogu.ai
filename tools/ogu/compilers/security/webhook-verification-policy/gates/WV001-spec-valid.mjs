import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** WV001 — spec-valid */
export async function run({ dir }) {
  const specPath = join(dir, 'webhook-verification-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'WV001', message: 'No webhook-verification-policy.json — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (err) { return { pass: false, code: 'WV001', message: 'webhook-verification-policy.json is not valid JSON', detail: err.message }; }

  const violations = [];
  if (!spec.feature) violations.push('Missing field: feature');
  if (!Array.isArray(spec.webhooks) || spec.webhooks.length === 0) violations.push('Missing field: webhooks (non-empty array)');

  if (Array.isArray(spec.webhooks)) {
    spec.webhooks.forEach((wh, i) => {
      if (!wh.provider) violations.push(`webhooks[${i}]: missing field "provider"`);
      if (!wh.signing_algorithm) violations.push(`webhooks[${i}]: missing field "signing_algorithm"`);
    });
  }

  if (violations.length > 0) return { pass: false, code: 'WV001', message: `Spec validation failed: ${violations.length} violation(s)`, detail: violations.join('\n') };
  return { pass: true, code: 'WV001', message: `Spec valid — ${spec.webhooks.length} webhook(s) declared` };
}
