import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SIDE_EFFECT_PATTERNS = [
  { pattern: /\bdocument\b/, label: 'DOM access (document)' },
  { pattern: /\bwindow\b/, label: 'Browser global (window)' },
  { pattern: /\bnavigator\b/, label: 'Browser API (navigator)' },
  { pattern: /\blocalStorage\b|\bsessionStorage\b/, label: 'Storage write' },
  { pattern: /\bfetch\s*\(|\baxios\b|\bhttp\b/, label: 'Network call' },
  { pattern: /\bsetTimeout\b|\bsetInterval\b|\bclearTimeout\b/, label: 'Timer side effect' },
  { pattern: /\bconsole\.(log|error|warn)\b/, label: 'Console output (side effect)' },
  { pattern: /\bprocess\.exit\b/, label: 'process.exit' },
  { pattern: /\bfs\.\b/, label: 'File system access' },
  { pattern: /\bMath\.random\b/, label: 'Non-deterministic (Math.random) — makes function impure' },
  { pattern: /\bDate\.now\b|new Date\(\)/, label: 'Non-deterministic (Date.now / new Date)' },
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  const violations = [];

  for (const file of files) {
    const lines = readFileSync(join(dir, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (line.trim().startsWith('//')) return;
      for (const { pattern, label } of SIDE_EFFECT_PATTERNS) {
        if (pattern.test(line)) {
          violations.push(`${file}:${i + 1} — ${label}: ${line.trim()}`);
        }
      }
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'UF004',
      message: `Side effects found (${violations.length}) — utility functions must be pure`,
      detail: violations.slice(0, 6).join('\n')
    };
  }

  return { pass: true, code: 'UF004', message: 'No side effects — function is pure' };
}
