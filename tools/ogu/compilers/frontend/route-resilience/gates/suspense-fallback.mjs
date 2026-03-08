import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx') && !f.endsWith('.test.ts'));
  if (!files.length) return { pass: false, code: 'RR006', message: 'No source file found' };

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  // Check if lazy() is used — if not, Suspense is optional
  const usesLazy = /React\.lazy|import\s*\(\s*['"]\.|lazy\s*\(\s*\(\s*\)/.test(content);
  if (!usesLazy) {
    return { pass: true, code: 'RR006', message: 'No lazy() routes — Suspense not required' };
  }

  // If lazy is used, Suspense with fallback must be present
  const hasSuspense = /<Suspense|React\.Suspense/.test(content);
  if (!hasSuspense) {
    return {
      pass: false, code: 'RR006',
      message: 'React.lazy() used but no <Suspense> wrapper found',
      detail: 'Wrap lazy routes: <Suspense fallback={<PageLoader />}><LazyComponent /></Suspense>'
    };
  }

  const hasFallback = /fallback=\{|fallback=</.test(content);
  if (!hasFallback) {
    return {
      pass: false, code: 'RR006',
      message: '<Suspense> found but missing fallback prop',
      detail: 'Add: <Suspense fallback={<Spinner />}>'
    };
  }

  return { pass: true, code: 'RR006', message: '<Suspense> with fallback wraps lazy routes' };
}
