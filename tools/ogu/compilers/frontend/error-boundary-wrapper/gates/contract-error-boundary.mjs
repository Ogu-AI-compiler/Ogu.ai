import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const RULES = [
  { id: 'has-fallback', description: 'Fallback UI defined', test: c => /FallbackComponent|fallback=|ErrorFallback|fallbackRender/.test(c) },
  { id: 'no-async-render', description: 'render() must not be async', test: c => !/async\s+render\s*\(/.test(c) },
  { id: 'exports-boundary', description: 'ErrorBoundary must be exported', test: c => /export\s+(default\s+|class\s+|function\s+)/.test(c) },
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx') && !f.endsWith('.test.ts'));
  if (!files.length) return { pass: false, code: 'EB009', message: 'No source file found' };
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = RULES.filter(r => !r.test(content));
  if (violations.length) return { pass: false, code: 'EB009', message: `Contract violations: ${violations.map(v => v.id).join(', ')}`, detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n') };
  return { pass: true, code: 'EB009', message: 'All error-boundary contract rules passed' };
}
