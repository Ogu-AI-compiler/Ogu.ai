/**
 * Gate: contract-rightsizing (RS007)
 * Validates that every workload and container is properly named. Anonymous
 * workloads and containers make violation messages unactionable — an engineer
 * cannot fix "container /?: missing resources" without knowing which workload
 * and container is being referenced.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'rightsizing-spec.json'), 'utf8'));
  const violations = [];

  for (const w of spec.workloads) {
    if (!w.name) {
      violations.push({ rule: 'workload-name-required', reason: 'Workload is missing a name field — violation messages will not identify which workload is affected' });
    }
    if (!Array.isArray(w.containers) || w.containers.length === 0) {
      violations.push({ rule: 'containers-required', workload: w.name || '(unnamed)', reason: 'Workload has no containers defined — resource profile is empty' });
    }
    for (const c of (w.containers || [])) {
      if (!c.name) {
        violations.push({ rule: 'container-name-required', workload: w.name || '(unnamed)', reason: 'Container is missing a name field — cannot identify which container to resize' });
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'RS007',
      message: `${violations.length} contract violation(s) in rightsizing-spec.json`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'RS007', message: 'Rightsizing profile contract satisfied' };
}
