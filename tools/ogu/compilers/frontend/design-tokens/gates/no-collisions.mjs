import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'tokens-spec.json'), 'utf8'));
  const allKeys = new Map(); // key → category
  const violations = [];

  const categories = ['colors', 'spacing', 'typography', 'radius', 'shadows'];

  function collectKeys(obj, category, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}-${key}` : key;
      if (allKeys.has(fullKey)) {
        violations.push(`Token '${fullKey}' defined in both '${allKeys.get(fullKey)}' and '${category}'`);
      } else {
        allKeys.set(fullKey, category);
      }
      if (typeof value === 'object' && !Array.isArray(value)) {
        collectKeys(value, category, fullKey);
      }
    }
  }

  for (const cat of categories) {
    if (spec[cat]) collectKeys(spec[cat], cat);
  }

  if (violations.length) {
    return { pass: false, code: 'DT005', message: `Token key collisions (${violations.length})`, detail: violations.join('\n') };
  }

  return { pass: true, code: 'DT005', message: `No key collisions — ${allKeys.size} unique tokens` };
}
