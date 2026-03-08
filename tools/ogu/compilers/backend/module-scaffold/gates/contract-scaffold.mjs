import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const contractPath = join(new URL('.', import.meta.url).pathname, '..', 'contracts', 'scaffold.contract.json');
  if (!existsSync(contractPath)) {
    return { pass: false, code: 'MS007', message: 'scaffold.contract.json not found' };
  }

  const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
  const spec = JSON.parse(readFileSync(join(dir, 'module-spec.json'), 'utf8'));
  const violations = [];

  for (const rule of contract.rules) {
    if (rule.id === 'MOD-001') {
      if (!spec.name || typeof spec.name !== 'string') {
        violations.push(`[${rule.id}] ${rule.description}`);
      }
    }
    if (rule.id === 'MOD-002') {
      if (!Array.isArray(spec.capabilities) || spec.capabilities.length === 0) {
        violations.push(`[${rule.id}] ${rule.description}`);
      }
    }
    if (rule.id === 'MOD-003') {
      // Entrypoint must exist
      const moduleName = spec.name;
      const candidates = [
        join(dir, 'src', 'modules', moduleName, 'index.ts'),
        join(dir, 'src', moduleName, 'index.ts'),
        join(dir, 'index.ts'),
      ];
      const exists = candidates.some(p => existsSync(p));
      if (!exists) {
        violations.push(`[${rule.id}] ${rule.description}`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'MS007',
      message: `${violations.length} scaffold contract violation(s)`,
      detail: violations.join('\n')
    };
  }

  return { pass: true, code: 'MS007', message: 'All scaffold contract rules satisfied' };
}
