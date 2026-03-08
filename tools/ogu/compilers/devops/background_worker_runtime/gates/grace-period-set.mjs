/**
 * Gate: grace-period-set (BW006)
 * Validates that a termination grace period is declared. Without a grace period, the
 * kubelet sends SIGKILL after the default 30 seconds, killing any in-flight message
 * processing. The message returns to the queue (if the broker supports it) but the
 * processing state may be partially complete — a correctness risk.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const MIN_GRACE = 30;   // below 30s is usually too short for even simple jobs
const MAX_GRACE = 600;  // above 10 minutes is a red flag — jobs should be checkpointed

export async function run({ dir }) {
  const spec        = JSON.parse(readFileSync(join(dir, 'bg-worker-spec.json'), 'utf8'));
  const gracePeriod = spec.terminationGracePeriodSeconds ?? spec.gracePeriodSeconds;

  if (gracePeriod === undefined) {
    return {
      pass: false, code: 'BW006',
      message: 'terminationGracePeriodSeconds not set — in-flight jobs will be killed on shutdown',
      detail: {
        hint: 'Set terminationGracePeriodSeconds to allow current jobs to finish. A value of 60–300s is typical. For long-running jobs, implement checkpointing instead of extending the grace period beyond 10 minutes.',
      },
    };
  }

  if (!Number.isInteger(gracePeriod) || gracePeriod < 1) {
    return {
      pass: false, code: 'BW006',
      message: `terminationGracePeriodSeconds must be a positive integer, got: ${gracePeriod}`,
      detail: { received: gracePeriod, hint: 'Set a positive integer value in seconds (e.g., 60)' },
    };
  }

  const warnings = [];
  if (gracePeriod < MIN_GRACE) warnings.push(`${gracePeriod}s may be too short — most jobs need at least ${MIN_GRACE}s to finish`);
  if (gracePeriod > MAX_GRACE) warnings.push(`${gracePeriod}s is very long — consider adding job checkpointing instead`);

  return {
    pass: true, code: 'BW006',
    message: `Grace period: ${gracePeriod}s${warnings.length ? ` (note: ${warnings.join('; ')})` : ''}`,
  };
}
