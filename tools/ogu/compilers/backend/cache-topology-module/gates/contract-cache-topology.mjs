import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const contractPath = join(new URL('.', import.meta.url).pathname, '..', 'contracts', 'cache-topology.contract.json');
  if (!existsSync(contractPath)) return { pass: false, code: 'CT008', message: 'cache-topology.contract.json not found' };

  const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
  const spec = JSON.parse(readFileSync(join(dir, 'cache-topology-spec.json'), 'utf8'));
  const violations = [];

  for (const rule of contract.rules) {
    if (rule.id === 'CTR-001') {
      const missing = spec.families.filter(f => !f.namespace);
      if (missing.length) violations.push(`[${rule.id}] ${rule.description}: ${missing.map(f=>f.name).join(', ')}`);
    }
    if (rule.id === 'CTR-002') {
      const missing = spec.families.filter(f => !f.ttl && !f.noExpiry);
      if (missing.length) violations.push(`[${rule.id}] ${rule.description}: ${missing.map(f=>f.name).join(', ')}`);
    }
    if (rule.id === 'CTR-003') {
      const missing = spec.families.filter(f => !f.serializer);
      if (missing.length) violations.push(`[${rule.id}] ${rule.description}: ${missing.map(f=>f.name).join(', ')}`);
    }
  }

  if (violations.length) return { pass: false, code: 'CT008', message: `${violations.length} contract violation(s)`, detail: violations.join('\n') };
  return { pass: true, code: 'CT008', message: 'All cache-topology contract rules satisfied' };
}
