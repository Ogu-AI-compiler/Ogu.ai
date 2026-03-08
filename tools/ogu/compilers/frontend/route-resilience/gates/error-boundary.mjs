import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx') && !f.endsWith('.test.ts'));
  if (!files.length) return { pass: false, code: 'RR004', message: 'No source file found' };

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  // Check ErrorBoundary class component or react-error-boundary import
  const hasErrorBoundary =
    /ErrorBoundary|componentDidCatch|getDerivedStateFromError|from\s+['"]react-error-boundary['"]/.test(content);

  if (!hasErrorBoundary) {
    return {
      pass: false, code: 'RR004',
      message: 'No ErrorBoundary found — routes must be wrapped in an error boundary',
      detail: 'Use react-error-boundary: import { ErrorBoundary } from "react-error-boundary"\nWrap routes: <ErrorBoundary FallbackComponent={ErrorFallback}>'
    };
  }

  // Check that ErrorBoundary is used as a wrapper (not just imported)
  const isUsed = /<ErrorBoundary|ErrorBoundary\s*>/.test(content);
  if (!isUsed) {
    return { pass: false, code: 'RR004', message: 'ErrorBoundary imported but not used — wrap your routes with <ErrorBoundary>' };
  }

  // Check for a fallback component or render prop
  const hasFallback = /FallbackComponent|fallback=|renderError|errorFallback|ErrorFallback/.test(content);
  if (!hasFallback) {
    return { pass: false, code: 'RR004', message: 'ErrorBoundary missing FallbackComponent — must render fallback UI on error' };
  }

  return { pass: true, code: 'RR004', message: 'ErrorBoundary with fallback found' };
}
