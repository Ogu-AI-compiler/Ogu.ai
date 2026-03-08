/**
 * Gate: pitr-defined (DBP002)
 * Point-in-Time Recovery (PITR) window must be defined as a concrete duration
 * string (e.g., "7d", "24h"). PITR is the only mechanism to recover to an
 * arbitrary point before a data corruption event — without it, you can only
 * restore to the last full snapshot, potentially losing hours of data.
 *
 * Accepted formats: "Nd" (days), "Nh" (hours)
 * Minimum meaningful PITR window: 1 hour
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Accepts: "7d", "24h", "7 days", "24 hours"
const PITR_DURATION_RE = /^(\d+)\s*(h|hour|hours|d|day|days)$/i;

function parsePitrToHours(pitrWindow) {
  const match = PITR_DURATION_RE.exec(String(pitrWindow).trim());
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (unit.startsWith('d')) return value * 24;
  return value; // hours
}

export async function run({ dir }) {
  const specPath = join(dir, 'backup-policy.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'DBP002', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'DBP002', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (!spec.pitr_window) {
    return {
      pass: false,
      code: 'DBP002',
      message: 'pitr_window is required',
      detail:
        'Point-in-Time Recovery allows restoring to any moment in time, not just snapshot boundaries.\n' +
        'Without PITR, a data corruption event forces a full snapshot restore, losing hours of data.\n' +
        'Set pitr_window to a concrete duration like "7d" or "24h".',
    };
  }

  const pitrHours = parsePitrToHours(spec.pitr_window);

  if (pitrHours === null) {
    return {
      pass: false,
      code: 'DBP002',
      message: `pitr_window "${spec.pitr_window}" is not a valid duration format`,
      detail: 'Use formats like "7d" (7 days) or "24h" (24 hours).',
    };
  }

  if (pitrHours < 1) {
    return {
      pass: false,
      code: 'DBP002',
      message: `pitr_window must be at least 1 hour, got: ${spec.pitr_window}`,
    };
  }

  // PITR window should be at least as long as the RPO
  if (typeof spec.rpo_hours === 'number' && pitrHours < spec.rpo_hours) {
    return {
      pass: false,
      code: 'DBP002',
      message: `pitr_window (${pitrHours}h) is shorter than rpo_hours (${spec.rpo_hours}h)`,
      detail: 'The PITR window must be at least as long as the RPO to allow recovery within the recovery point objective.',
    };
  }

  return {
    pass: true,
    code: 'DBP002',
    message: `pitr_window "${spec.pitr_window}" (${pitrHours}h) is valid`,
  };
}
