import { readFileSync, readdirSync } from 'fs'; import { join } from 'path';
const RULES = [
  { id: 'uses-swr', description: 'useSWR is imported and used', test: c => /from\s+['"]swr['"]/.test(c) && /useSWR\s*\(/.test(c) },
  { id: 'typed-data', description: 'useSWR is typed: useSWR<T>', test: c => /useSWR\s*<\w/.test(c) },
  { id: 'exported-hook', description: 'Custom hook is exported', test: c => /export\s+(function\s+use|const\s+use)/.test(c) },
];
export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));
  if (!files.length) return { pass: false, code: 'SW010', message: 'No source file found' };
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = RULES.filter(r => !r.test(content));
  if (violations.length) return { pass: false, code: 'SW010', message: `Contract violations: ${violations.map(v => v.id).join(', ')}`, detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n') };
  return { pass: true, code: 'SW010', message: 'All SWR resource contract rules passed' };
}
