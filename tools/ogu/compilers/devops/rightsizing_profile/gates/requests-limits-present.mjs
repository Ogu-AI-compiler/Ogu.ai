/**
 * Gate: requests-limits-present (RS002)
 * Validates that every container in every workload declares both resource
 * requests and limits for CPU and memory. Containers without requests are
 * not considered for scheduling quality guarantees. Containers without
 * limits are not protected from runaway memory or CPU consumption.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'rightsizing-spec.json'), 'utf8'));
  const violations = [];

  for (const w of spec.workloads) {
    for (const c of (w.containers || [])) {
      const id = `${w.name}/${c.name}`;
      if (!c.requests?.cpu || !c.requests?.memory) {
        violations.push({ container: id, field: 'requests', reason: 'Missing resource requests — container will not receive scheduling quality guarantees', hint: 'Add requests.cpu and requests.memory' });
      }
      if (!c.limits?.cpu || !c.limits?.memory) {
        violations.push({ container: id, field: 'limits', reason: 'Missing resource limits — container can consume unbounded CPU and memory', hint: 'Add limits.cpu and limits.memory' });
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'RS002',
      message: `${violations.length} container(s) missing resource requests or limits`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'RS002', message: 'All containers have requests and limits' };
}
