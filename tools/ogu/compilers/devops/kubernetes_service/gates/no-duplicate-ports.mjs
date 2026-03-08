/**
 * Gate: no-duplicate-ports (KS004)
 * Ensures that no two port entries share the same port number or name. Kubernetes
 * rejects Services with duplicate port numbers. Duplicate port names cause ambiguous
 * DNS SRV records and confuse service meshes that rely on named ports.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'k8s-service-spec.json'), 'utf8'));
  const seenPorts  = new Set();
  const seenNames  = new Set();
  const violations = [];

  for (const p of (spec.ports || [])) {
    if (p.port && seenPorts.has(p.port)) {
      violations.push({ field: 'port', value: p.port, reason: `port number ${p.port} appears more than once` });
    }
    if (p.name && seenNames.has(p.name)) {
      violations.push({ field: 'name', value: p.name, reason: `port name "${p.name}" appears more than once` });
    }
    if (p.port) seenPorts.add(p.port);
    if (p.name) seenNames.add(p.name);
  }

  if (violations.length) {
    return {
      pass: false, code: 'KS004',
      message: `${violations.length} duplicate port entry(ies)`,
      detail: {
        violations,
        hint: 'Each port entry must have a unique port number and name. Remove or rename duplicates.',
      },
    };
  }

  return { pass: true, code: 'KS004', message: 'No duplicate port numbers or names' };
}
