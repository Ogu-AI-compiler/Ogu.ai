import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx'));
  if (!files.length) return { pass: false, code: 'EB005', message: 'No source file found' };
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  const hasFallback = /FallbackComponent|fallback=|renderError|ErrorFallback|fallbackRender/.test(content);
  if (!hasFallback) return { pass: false, code: 'EB005', message: 'No fallback UI defined — ErrorBoundary must render something on error' };

  // Fallback component should not call hooks that might throw
  const fallbackThrows = /function\s+\w*Fallback[\s\S]{0,300}throw\s+new/.test(content);
  if (fallbackThrows) return { pass: false, code: 'EB005', message: 'Fallback component can throw — fallback must have a safe render path' };

  return { pass: true, code: 'EB005', message: 'Fallback UI is defined and safe' };
}
