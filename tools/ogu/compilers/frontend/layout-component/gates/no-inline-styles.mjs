import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.tsx') && !f.endsWith('.test.tsx'));
  const violations = [];

  for (const file of files) {
    const lines = readFileSync(join(dir, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      // style={{ ... }} with actual values
      if (/style\s*=\s*\{\{/.test(line) && !/style=\{\{.*\}\}.*\/\/ layout/.test(line)) {
        violations.push(`${file}:${i + 1} — Inline style: ${line.trim()}`);
      }
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'LC006',
      message: `Inline styles found (${violations.length}) — use Tailwind classes`,
      detail: violations.slice(0, 5).join('\n')
    };
  }

  return { pass: true, code: 'LC006', message: 'No inline styles — Tailwind classes used' };
}
