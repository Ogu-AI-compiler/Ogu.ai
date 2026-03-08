import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const CONTRACT_RULES = [
  { id: 'typed-events', description: 'Event types must use TypeScript interfaces or types, not plain objects', test: c => /interface\s+\w+Event|type\s+\w+Event\s*=/.test(c) },
  { id: 'track-typed', description: 'track() function must be typed — no untyped calls', test: c => /track\s*<\w+>|function\s+track\s*\([^)]*:\s*\w+Event/.test(c) || /track\s*\(\s*\w+\s*,/.test(c) },
  { id: 'exported-events', description: 'Event type definitions must be exported for cross-module use', test: c => /export\s+(interface|type|const)\s+\w+Event/.test(c) },
  { id: 'no-magic-strings', description: 'Event names should be constants, not inline strings in track()', test: c => !/track\s*\(\s*['"][A-Z_]+['"]/.test(c) || /const\s+\w+\s*=\s*['"][A-Z_]+['"]/.test(c) },
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx') && !f.endsWith('.test.ts'));
  if (!files.length) return { pass: false, code: 'AE009', message: 'No analytics file found' };
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = CONTRACT_RULES.filter(r => !r.test(content));
  if (violations.length) return { pass: false, code: 'AE009', message: `Contract violations: ${violations.map(v => v.id).join(', ')}`, detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n') };
  return { pass: true, code: 'AE009', message: 'All analytics contract rules passed' };
}
