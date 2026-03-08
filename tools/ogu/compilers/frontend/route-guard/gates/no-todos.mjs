import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
  const violations = [];

  for (const file of files) {
    const lines = readFileSync(join(dir, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/\b(TODO|FIXME|HACK|XXX)\b/.test(line)) {
        violations.push(`${file}:${i + 1} — ${line.trim()}`);
      }
    });
  }

  if (violations.length) {
    return { pass: false, code: 'RG007', message: `${violations.length} TODO/FIXME found`, detail: violations.join('\n') };
  }

  return { pass: true, code: 'RG007', message: 'No TODOs found' };
}
