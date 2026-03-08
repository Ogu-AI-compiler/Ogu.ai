import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const contractPath = join(new URL('.', import.meta.url).pathname, '..', 'contracts', 'client-runtime.contract.json');
  if (!existsSync(contractPath)) {
    return { pass: false, code: 'SR009', message: 'client-runtime.contract.json not found' };
  }

  const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
  const spec = JSON.parse(readFileSync(join(dir, 'client-runtime-spec.json'), 'utf8'));
  const violations = [];

  for (const rule of contract.rules) {
    if (rule.id === 'CR-001') {
      if (!spec.defaultTimeout || spec.defaultTimeout <= 0) {
        violations.push(`[${rule.id}] ${rule.description}`);
      }
    }
    if (rule.id === 'CR-002') {
      if (!spec.secretHeaders || spec.secretHeaders.length === 0) {
        violations.push(`[${rule.id}] ${rule.description} — secretHeaders is empty`);
      }
    }
    if (rule.id === 'CR-003') {
      const retry = spec.retryPolicy;
      if (retry && retry.maxRetries > 0) {
        if (!retry.allowedMethods && !retry.allowedStatuses) {
          violations.push(`[${rule.id}] ${rule.description}`);
        }
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'SR009',
      message: `${violations.length} client-runtime contract violation(s)`,
      detail: violations.join('\n')
    };
  }

  return { pass: true, code: 'SR009', message: 'All client-runtime contract rules satisfied' };
}
