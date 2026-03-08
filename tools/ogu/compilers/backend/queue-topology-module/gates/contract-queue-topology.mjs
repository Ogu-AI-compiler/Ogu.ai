import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const contractPath = join(new URL('.', import.meta.url).pathname, '..', 'contracts', 'queue-topology.contract.json');
  if (!existsSync(contractPath)) {
    return { pass: false, code: 'QT008', message: 'queue-topology.contract.json not found' };
  }

  const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
  const spec = JSON.parse(readFileSync(join(dir, 'queue-topology-spec.json'), 'utf8'));
  const violations = [];

  for (const rule of contract.rules) {
    if (rule.id === 'QTR-001') {
      const hasDuplicate = new Set(spec.queues.map(q => q.name)).size < spec.queues.length;
      if (hasDuplicate) violations.push(`[${rule.id}] ${rule.description}`);
    }
    if (rule.id === 'QTR-002') {
      const missing = spec.queues.filter(q => !q.retryPolicy && !q.noRetry);
      if (missing.length) violations.push(`[${rule.id}] ${rule.description}: ${missing.map(q => q.name).join(', ')}`);
    }
    if (rule.id === 'QTR-003') {
      const missing = spec.queues.filter(q => !q.retention);
      if (missing.length) violations.push(`[${rule.id}] ${rule.description}: ${missing.map(q => q.name).join(', ')}`);
    }
  }

  if (violations.length) {
    return { pass: false, code: 'QT008', message: `${violations.length} contract violation(s)`, detail: violations.join('\n') };
  }

  return { pass: true, code: 'QT008', message: 'All queue-topology contract rules satisfied' };
}
