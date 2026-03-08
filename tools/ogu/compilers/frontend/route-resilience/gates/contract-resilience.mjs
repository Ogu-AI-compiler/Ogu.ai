import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const CONTRACT_RULES = [
  { id: 'error-boundary', description: 'Must use ErrorBoundary with FallbackComponent', test: c => /ErrorBoundary/.test(c) && /FallbackComponent|fallback=/.test(c) },
  { id: 'not-found-route', description: 'Must have a catch-all route (path="*") or NotFound component', test: c => /path=["']\*["']|NotFound|Page404/.test(c) },
  { id: 'exported-components', description: 'ErrorFallback and NotFound must be exported', test: c => /export\s+(function|const)\s+(ErrorFallback|NotFound|Error404|Page404)/.test(c) },
  { id: 'error-reset', description: 'ErrorBoundary must support reset (resetErrorBoundary or retry)', test: c => /resetErrorBoundary|onReset|retry|reset/.test(c) },
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx') && !f.endsWith('.test.ts'));
  if (!files.length) return { pass: false, code: 'RR010', message: 'No source file found' };
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = CONTRACT_RULES.filter(r => !r.test(content));
  if (violations.length) return { pass: false, code: 'RR010', message: `Contract violations: ${violations.map(v => v.id).join(', ')}`, detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n') };
  return { pass: true, code: 'RR010', message: 'All resilience contract rules passed' };
}
