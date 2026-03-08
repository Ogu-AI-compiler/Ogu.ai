import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const contractPath = join(new URL('.', import.meta.url).pathname, '..', 'contracts', 'test-harness.contract.json');
  if (!existsSync(contractPath)) {
    return { pass: false, code: 'TH008', message: 'test-harness.contract.json not found' };
  }

  const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
  const spec = JSON.parse(readFileSync(join(dir, 'test-harness-spec.json'), 'utf8'));

  const violations = [];

  for (const rule of contract.rules) {
    if (rule.id === 'TH-001') {
      if (!['vitest', 'jest'].includes(spec.runner)) {
        violations.push(`[${rule.id}] ${rule.description}`);
      }
    }
    if (rule.id === 'TH-002') {
      const t = spec.coverageThresholds;
      const allZero = ['lines', 'functions', 'branches', 'statements'].every(k => t[k] === 0);
      if (allZero) {
        violations.push(`[${rule.id}] ${rule.description} — all thresholds are 0`);
      }
    }
    if (rule.id === 'TH-003') {
      const hasUnit = spec.environments.some(e =>
        e.name?.toLowerCase().includes('unit') || e.name?.toLowerCase().includes('node')
      );
      if (!hasUnit) {
        violations.push(`[${rule.id}] ${rule.description}`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'TH008',
      message: `${violations.length} test-harness contract violation(s)`,
      detail: violations.join('\n')
    };
  }

  return { pass: true, code: 'TH008', message: 'All test-harness contract rules satisfied' };
}
