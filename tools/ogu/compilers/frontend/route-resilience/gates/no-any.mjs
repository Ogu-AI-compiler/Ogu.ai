import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));
  const violations = [];

  for (const file of files) {
    const lines = readFileSync(join(dir, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/:\s*any\b/.test(line) && !line.trim().startsWith('//')) {
        violations.push(`${file}:${i + 1} — ${line.trim()}`);
      }
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'RR003',
      message: `Explicit 'any' found in ${violations.length} location(s)`,
      detail: violations.slice(0, 5).join('\n')
    };
  }

  return { pass: true, code: 'RR003', message: 'No explicit any types' };
}
