import { readFileSync } from 'fs';
import { join } from 'path';

function findEmpty(obj, prefix = '') {
  const empties = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string' && v.trim() === '') empties.push(fullKey);
    else if (typeof v === 'object') empties.push(...findEmpty(v, fullKey));
  }
  return empties;
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'i18n-spec.json'), 'utf8'));
  const violations = [];

  for (const locale of spec.locales) {
    const data = JSON.parse(readFileSync(join(dir, `${locale}.json`), 'utf8'));
    const empties = findEmpty(data);
    if (empties.length) {
      violations.push(`[${locale}] empty values: ${empties.slice(0, 5).join(', ')}${empties.length > 5 ? ` (+${empties.length - 5})` : ''}`);
    }
  }

  if (violations.length) {
    return { pass: false, code: 'I1005', message: `Empty translation values (${violations.length} locales affected)`, detail: violations.join('\n') };
  }

  return { pass: true, code: 'I1005', message: 'No empty translation values' };
}
