import { readFileSync, existsSync, readdirSync } from 'fs'; import { join } from 'path';
const RULES = [
  { id: 'has-barrel', description: 'index.ts barrel file exists', test: (_c, dir) => existsSync(join(dir, 'index.ts')) },
  { id: 'has-types', description: 'Has TypeScript type definitions', test: (c) => /interface\s+\w+|type\s+\w+\s*=/.test(c) },
  { id: 'no-default-export-all', description: 'No default export of entire module', test: (c) => !/export\s+default\s+\*/.test(c) },
];
export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = RULES.filter(r => !r.test(content, dir));
  if (violations.length) return { pass: false, code: 'FM007', message: `Contract violations: ${violations.map(v => v.id).join(', ')}`, detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n') };
  return { pass: true, code: 'FM007', message: 'All feature-module contract rules passed' };
}
