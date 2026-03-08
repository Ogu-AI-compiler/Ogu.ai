/**
 * Gate: contract-probe-config (PC007)
 * Enforces probe timing contracts: liveness.initialDelaySeconds must be >= the startup
 * probe's total maximum time to prevent the liveness probe from killing a slow-starting
 * container before it finishes startup. Readiness should also fail faster than liveness
 * to stop serving traffic before Kubernetes decides to restart the container.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'probe-config-spec.json'), 'utf8'));
  const violations = [];

  if (spec.probes.startup && spec.probes.liveness) {
    const startupMaxTime   = (spec.probes.startup.periodSeconds || 10) * (spec.probes.startup.failureThreshold || 3);
    const livenessDelay    = spec.probes.liveness.initialDelaySeconds || 0;
    if (startupMaxTime > 0 && livenessDelay < startupMaxTime) {
      violations.push({
        rule:          'liveness-delay-must-exceed-startup-window',
        livenessDelay,
        startupMaxTime,
        reason:        `liveness.initialDelaySeconds (${livenessDelay}s) < startup max time (${startupMaxTime}s) — liveness will kill the container before startup completes`,
        hint:          `Set liveness.initialDelaySeconds to at least ${startupMaxTime} seconds`,
      });
    }
  }

  if (spec.probes.readiness && spec.probes.liveness) {
    const readinessFail = spec.probes.readiness.failureThreshold || 3;
    const livenessFail  = spec.probes.liveness.failureThreshold || 3;
    if (readinessFail > livenessFail) {
      violations.push({
        rule:           'readiness-should-fail-before-liveness',
        readinessFail,
        livenessFail,
        reason:         `readiness.failureThreshold (${readinessFail}) > liveness.failureThreshold (${livenessFail}) — traffic will be stopped after liveness restarts the container, not before`,
        hint:           'Readiness should have an equal or lower failureThreshold than liveness',
      });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'PC007',
      message: `${violations.length} probe timing contract violation(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'PC007', message: 'Probe config contract satisfied — timing relationships are correct' };
}
