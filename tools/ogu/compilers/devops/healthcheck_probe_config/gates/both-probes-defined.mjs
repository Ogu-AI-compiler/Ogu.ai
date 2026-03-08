/**
 * Gate: both-probes-defined (PC005)
 * Ensures both liveness and readiness probes are defined. Liveness without readiness
 * means the container receives traffic before it is ready to serve it (startup spike).
 * Readiness without liveness means the kubelet can't detect a deadlocked container
 * and will never restart it automatically.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'probe-config-spec.json'), 'utf8'));

  if (spec.skipProbeRequirement) {
    return { pass: true, code: 'PC005', message: 'skipProbeRequirement=true — both-probes check skipped', skipped: true };
  }

  const missing = [];
  if (!spec.probes.liveness)  missing.push('liveness');
  if (!spec.probes.readiness) missing.push('readiness');

  if (missing.length) {
    return {
      pass: false, code: 'PC005',
      message: `Missing required probe(s): ${missing.join(', ')}`,
      detail: {
        missing,
        hint: 'Both liveness and readiness probes are required. Add skipProbeRequirement: true (with justification) only for init containers or batch jobs.',
      },
    };
  }

  return { pass: true, code: 'PC005', message: 'Both liveness and readiness probes are defined' };
}
