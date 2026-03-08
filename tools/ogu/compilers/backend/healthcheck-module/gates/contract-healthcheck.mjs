import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const contractPath = join(new URL('.', import.meta.url).pathname, '..', 'contracts', 'healthcheck.contract.json');
  if (!existsSync(contractPath)) return { pass: false, code: 'HC009', message: 'healthcheck.contract.json not found' };

  const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
  const spec = JSON.parse(readFileSync(join(dir, 'healthcheck-spec.json'), 'utf8'));
  const violations = [];

  for (const rule of contract.rules) {
    if (rule.id === 'HC-001') {
      const noTimeout = spec.dependencies.filter(d => !d.timeoutMs || d.timeoutMs <= 0);
      if (noTimeout.length) violations.push(`[${rule.id}] ${rule.description}: ${noTimeout.map(d=>d.name).join(', ')}`);
    }
    if (rule.id === 'HC-002') {
      if (!spec.dependencies || spec.dependencies.length === 0) violations.push(`[${rule.id}] ${rule.description}`);
    }
    if (rule.id === 'HC-003') {
      const hasLivenessRemote = spec.livenessChecks?.some(c =>
        ['database', 'redis', 'db', 'queue', 'http'].some(r => c.toLowerCase().includes(r))
      );
      if (hasLivenessRemote) violations.push(`[${rule.id}] ${rule.description}`);
    }
  }

  if (violations.length) return { pass: false, code: 'HC009', message: `${violations.length} contract violation(s)`, detail: violations.join('\n') };
  return { pass: true, code: 'HC009', message: 'All healthcheck contract rules satisfied' };
}
