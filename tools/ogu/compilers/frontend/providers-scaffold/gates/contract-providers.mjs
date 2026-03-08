import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const CONTRACT_RULES = [
  { id: 'queryclient-module-scope', description: 'QueryClient must be created at module scope, not inside a component', test: c => !/function\s+\w+[^{]*\{[\s\S]*?new QueryClient/.test(c) },
  { id: 'error-boundary-present', description: 'Providers tree should include an ErrorBoundary as outermost wrapper', test: c => /ErrorBoundary/.test(c) },
  { id: 'single-export', description: 'Providers component must have a single named or default export', test: c => /export\s+(default|function|const)\s+\w*[Pp]rovider/.test(c) },
  { id: 'accepts-children', description: 'Providers wrapper must accept and render children', test: c => /\{children\}/.test(c) },
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx'));
  if (!files.length) return { pass: false, code: 'PR009', message: 'No providers file found' };
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = CONTRACT_RULES.filter(r => !r.test(content));
  if (violations.length) return { pass: false, code: 'PR009', message: `Contract violations: ${violations.map(v => v.id).join(', ')}`, detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n') };
  return { pass: true, code: 'PR009', message: 'All providers contract rules passed' };
}
