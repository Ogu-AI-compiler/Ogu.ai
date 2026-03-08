import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.tsx') && !f.endsWith('.test.tsx'));
  if (!files.length) return { pass: false, code: 'PR005', message: 'No providers file found' };

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const providerPattern = /<(\w+Provider)\b/g;
  const seen = new Map();
  const violations = [];
  let match;

  while ((match = providerPattern.exec(content)) !== null) {
    const name = match[1];
    seen.set(name, (seen.get(name) || 0) + 1);
  }

  for (const [name, count] of seen) {
    if (count > 1) violations.push(`${name} appears ${count} times — providers must not be duplicated`);
  }

  if (violations.length) return { pass: false, code: 'PR005', message: `Duplicate providers (${violations.length})`, detail: violations.join('\n') };
  return { pass: true, code: 'PR005', message: 'No duplicate providers' };
}
