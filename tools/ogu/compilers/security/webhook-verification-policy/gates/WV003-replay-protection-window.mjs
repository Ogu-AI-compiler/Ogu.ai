import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** WV003 — replay-protection-window: timestamp replay window must be <= 300 seconds */
export async function run({ dir }) {
  const specPath = join(dir, 'webhook-verification-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'WV003', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'WV003', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!Array.isArray(spec.webhooks)) return { pass: true, code: 'WV003', message: 'No webhooks — gate skipped', skipped: true };

  const MAX_REPLAY_WINDOW_SECONDS = 300;
  const violations = [];

  for (const wh of spec.webhooks) {
    const id = wh.provider || '?';
    const replayWindow = wh.replay_protection_window_seconds ?? wh.timestamp_tolerance_seconds ?? wh.replay_window;

    if (replayWindow === undefined || replayWindow === null) {
      violations.push(`Webhook "${id}": replay_protection_window_seconds is not declared — must be ≤ ${MAX_REPLAY_WINDOW_SECONDS}s to prevent replay attacks`);
      continue;
    }
    if (typeof replayWindow !== 'number' || replayWindow <= 0) {
      violations.push(`Webhook "${id}": replay_protection_window_seconds must be a positive number`);
      continue;
    }
    if (replayWindow > MAX_REPLAY_WINDOW_SECONDS) {
      violations.push(`Webhook "${id}": replay_protection_window_seconds=${replayWindow} exceeds maximum of ${MAX_REPLAY_WINDOW_SECONDS}s`);
    }
  }

  if (violations.length > 0) return { pass: false, code: 'WV003', message: `${violations.length} webhook(s) have replay protection issues`, detail: violations.join('\n') };
  return { pass: true, code: 'WV003', message: `Replay protection window valid for all ${spec.webhooks.length} webhook(s)` };
}
