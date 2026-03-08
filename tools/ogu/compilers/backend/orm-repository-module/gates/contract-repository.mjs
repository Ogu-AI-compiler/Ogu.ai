import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const contractPath = join(new URL('.', import.meta.url).pathname, '..', 'contracts', 'repository.contract.json');
  if (!existsSync(contractPath)) return { pass: false, code: 'OR012', message: 'repository.contract.json not found' };

  const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
  const spec = JSON.parse(readFileSync(join(dir, 'repository-spec.json'), 'utf8'));
  const violations = [];

  for (const rule of contract.rules) {
    if (rule.id === 'REPO-001') {
      if (!spec.entity) violations.push(`[${rule.id}] ${rule.description}`);
    }
    if (rule.id === 'REPO-002') {
      if (!['prisma','drizzle','knex','typeorm'].includes(spec.orm)) violations.push(`[${rule.id}] ${rule.description}`);
    }
    if (rule.id === 'REPO-003') {
      const writeMethods = spec.methods.filter(m => m.type === 'write' || m.type === 'delete');
      const voidReturns = writeMethods.filter(m => !m.returns || m.returns === 'void');
      if (voidReturns.length) violations.push(`[${rule.id}] ${rule.description}: ${voidReturns.map(m=>m.name).join(', ')}`);
    }
  }

  if (violations.length) return { pass: false, code: 'OR012', message: `${violations.length} contract violation(s)`, detail: violations.join('\n') };
  return { pass: true, code: 'OR012', message: 'All repository contract rules satisfied' };
}
