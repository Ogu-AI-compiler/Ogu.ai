/**
 * Gate: worker-not-exposed (BW005)
 * Background workers must not expose external ports — a worker that accepts
 * inbound connections is a service, not a worker. External exposure introduces
 * an attack surface without any corresponding routing or security boundary.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'bg-worker-spec.json'), 'utf8'));

  if (spec.exposedPorts && !spec.allowExternalExposure) {
    return {
      pass: false, code: 'BW005',
      message: 'Worker has exposed ports without allowExternalExposure flag',
      detail: {
        exposedPorts: spec.exposedPorts,
        reason:       'Background workers should not accept inbound connections — they should only poll or subscribe to queues',
        hint:         'Remove exposedPorts, or add allowExternalExposure: true with a justification if the worker also serves health checks',
      },
    };
  }

  return { pass: true, code: 'BW005', message: 'Worker is not externally exposed' };
}
