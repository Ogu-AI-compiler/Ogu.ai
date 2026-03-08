/**
 * Gate: requests-lte-limits (RS004)
 * Validates that resource requests do not exceed limits for any container.
 * Kubernetes rejects pods where requests > limits at admission time — the pod
 * will never start and the error message can be confusing.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

function parseCPU(v) {
  if (!v) return 0;
  if (String(v).endsWith('m')) return parseInt(v) / 1000;
  return parseFloat(v);
}

function parseMemMi(v) {
  if (!v) return 0;
  if (String(v).endsWith('Gi')) return parseFloat(v) * 1024;
  if (String(v).endsWith('Mi')) return parseFloat(v);
  return parseFloat(v);
}

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'rightsizing-spec.json'), 'utf8'));
  const violations = [];

  for (const w of spec.workloads) {
    for (const c of (w.containers || [])) {
      const id = `${w.name}/${c.name}`;
      if (c.requests?.cpu && c.limits?.cpu && parseCPU(c.requests.cpu) > parseCPU(c.limits.cpu)) {
        violations.push({ container: id, field: 'cpu', request: c.requests.cpu, limit: c.limits.cpu, reason: `CPU request (${c.requests.cpu}) > limit (${c.limits.cpu}) — Kubernetes will reject this pod at admission` });
      }
      if (c.requests?.memory && c.limits?.memory && parseMemMi(c.requests.memory) > parseMemMi(c.limits.memory)) {
        violations.push({ container: id, field: 'memory', request: c.requests.memory, limit: c.limits.memory, reason: `Memory request (${c.requests.memory}) > limit (${c.limits.memory}) — Kubernetes will reject this pod at admission` });
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'RS004',
      message: `${violations.length} container(s) where requests exceed limits`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'RS004', message: 'All requests ≤ limits' };
}
