import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** WV002 — constant-time-comparison: signature verification must use constant-time comparison */
export async function run({ dir }) {
  const specPath = join(dir, 'webhook-verification-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'WV002', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'WV002', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!Array.isArray(spec.webhooks)) return { pass: true, code: 'WV002', message: 'No webhooks — gate skipped', skipped: true };

  const violations = [];
  for (const wh of spec.webhooks) {
    const id = `${wh.provider}`;
    if (!wh.constant_time_comparison && wh.constant_time_comparison !== true) {
      if (wh.constant_time_comparison === false) {
        violations.push(`Webhook "${id}": constant_time_comparison is explicitly false — must use constant-time comparison to prevent timing attacks`);
      } else {
        violations.push(`Webhook "${id}": constant_time_comparison must be declared as true — timing attacks can extract HMAC secrets via naive string comparison`);
      }
    }
  }

  if (violations.length > 0) return { pass: false, code: 'WV002', message: `${violations.length} webhook(s) missing constant-time comparison`, detail: violations.join('\n') };
  return { pass: true, code: 'WV002', message: `Constant-time comparison declared for all ${spec.webhooks.length} webhook(s)` };
}
