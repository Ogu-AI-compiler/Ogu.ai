import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx') && !f.endsWith('.test.ts'));

  const violations = [];

  for (const file of files) {
    const lines = readFileSync(join(dir, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      // Network calls in skeleton
      if (/\bfetch\s*\(|\baxios\.\w+\(|\buseQuery\b|\buseSWR\b/.test(line)) {
        violations.push(`${file}:${i + 1} — Network call in skeleton component: ${line.trim()}`);
      }
      // Data prop access patterns (data.xxx, user.name, etc.) — not just static props
      if (/\b(data|user|item|record|response)\s*\?\.\w+/.test(line) && !/aria-label|className/.test(line)) {
        violations.push(`${file}:${i + 1} — Real data access in skeleton: ${line.trim()}`);
      }
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'SK007',
      message: `Real data found in skeleton (${violations.length})`,
      detail: violations.slice(0, 5).join('\n') + '\nSkeletons must be purely structural — no real data'
    };
  }

  return { pass: true, code: 'SK007', message: 'No real data in skeleton — purely structural' };
}
