import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

export async function run({ dir }) {
  const contractPath = join(new URL('.', import.meta.url).pathname, '..', 'contracts', 'config.contract.json');
  if (!existsSync(contractPath)) {
    return { pass: false, code: 'CV010', message: 'config.contract.json not found in compiler contracts directory' };
  }

  const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
  const spec = JSON.parse(readFileSync(join(dir, 'config-spec.json'), 'utf8'));

  const violations = [];

  for (const rule of contract.rules) {
    if (rule.id === 'CONFIG-001') {
      // All exports must be schema-validated
      if (!spec.envKeys || spec.envKeys.length === 0) {
        violations.push(`[${rule.id}] ${rule.description}`);
      }
    }
    if (rule.id === 'CONFIG-002') {
      // Unknown key policy must be explicit
      if (!['reject', 'ignore'].includes(spec.unknownKeyPolicy)) {
        violations.push(`[${rule.id}] ${rule.description}`);
      }
    }
    if (rule.id === 'CONFIG-003') {
      // At least one key must be required
      const hasRequired = spec.envKeys.some(k => k.required === true);
      if (!hasRequired) {
        violations.push(`[${rule.id}] ${rule.description} — no required keys declared`);
      }
    }
    if (rule.id === 'CONFIG-004') {
      // Secret keys must be marked
      const unmarkedSecrets = spec.envKeys.filter(k => {
        const secretPatterns = [/secret/i, /password/i, /token/i, /api[_-]?key/i, /private/i];
        return secretPatterns.some(p => p.test(k.name)) && k.secret !== true;
      });
      if (unmarkedSecrets.length) {
        violations.push(`[${rule.id}] ${rule.description}: ${unmarkedSecrets.map(k => k.name).join(', ')}`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'CV010',
      message: `${violations.length} contract violation(s)`,
      detail: violations.join('\n')
    };
  }

  return { pass: true, code: 'CV010', message: 'All config contract rules satisfied' };
}
