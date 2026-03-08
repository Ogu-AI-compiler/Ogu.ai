/**
 * Gate: limits-not-exceed-node (RS003)
 * When nodeLimits are declared, validates that no container limit exceeds the
 * node's total capacity. A container limit greater than the node max means the
 * pod can never be scheduled — Kubernetes will keep it in Pending forever.
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
  if (String(v).endsWith('Ki')) return parseFloat(v) / 1024;
  return parseFloat(v);
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'rightsizing-spec.json'), 'utf8'));

  if (!spec.nodeLimits) {
    return { pass: true, code: 'RS003', message: 'No nodeLimits defined — skipping node capacity check', skipped: true };
  }

  const maxCPU = parseCPU(spec.nodeLimits.cpu);
  const maxMem = parseMemMi(spec.nodeLimits.memory);
  const violations = [];

  for (const w of spec.workloads) {
    for (const c of (w.containers || [])) {
      const id = `${w.name}/${c.name}`;
      if (c.limits?.cpu && parseCPU(c.limits.cpu) > maxCPU) {
        violations.push({ container: id, field: 'limits.cpu', value: c.limits.cpu, nodeMax: spec.nodeLimits.cpu, reason: 'CPU limit exceeds node capacity — pod will never be scheduled' });
      }
      if (c.limits?.memory && parseMemMi(c.limits.memory) > maxMem) {
        violations.push({ container: id, field: 'limits.memory', value: c.limits.memory, nodeMax: spec.nodeLimits.memory, reason: 'Memory limit exceeds node capacity — pod will never be scheduled' });
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'RS003',
      message: `${violations.length} limit(s) exceed node capacity`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'RS003', message: 'All limits within node capacity' };
}
