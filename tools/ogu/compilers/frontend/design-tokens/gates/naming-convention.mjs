import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'tokens-spec.json'), 'utf8'));
  const violations = [];

  function checkKeys(obj, path = '') {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = path ? `${path}.${key}` : key;
      // Token keys must be kebab-case
      if (!/^[a-z][a-z0-9-]*$/.test(key)) {
        violations.push(`'${fullKey}': keys must be kebab-case (lowercase, hyphens only). Got: '${key}'`);
      }
      if (typeof value === 'object' && !Array.isArray(value)) {
        checkKeys(value, fullKey);
      }
    }
  }

  // Check all token categories
  const categories = ['colors', 'spacing', 'typography', 'radius', 'shadows', 'animation'];
  for (const cat of categories) {
    if (spec[cat]) checkKeys(spec[cat], cat);
  }

  if (violations.length) {
    return {
      pass: false, code: 'DT002',
      message: `Naming violations (${violations.length})`,
      detail: violations.slice(0, 5).join('\n')
    };
  }

  return { pass: true, code: 'DT002', message: 'All token names use kebab-case' };
}
