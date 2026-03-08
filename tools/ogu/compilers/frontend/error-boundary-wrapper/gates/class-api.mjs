import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx') && !f.endsWith('.test.ts'));
  if (!files.length) return { pass: false, code: 'EB004', message: 'No source file found' };
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  const hasClassComponent = /class\s+\w+\s+extends\s+(React\.)?Component/.test(content);
  const hasGetDerived = /getDerivedStateFromError/.test(content);
  const hasComponentDidCatch = /componentDidCatch/.test(content);
  const usesReactErrorBoundary = /from\s+['"]react-error-boundary['"]/.test(content);

  if (!usesReactErrorBoundary && !hasClassComponent) {
    return { pass: false, code: 'EB004', message: 'ErrorBoundary must be a class component or use react-error-boundary library' };
  }
  if (hasClassComponent && !hasGetDerived && !hasComponentDidCatch) {
    return { pass: false, code: 'EB004', message: 'Class ErrorBoundary missing getDerivedStateFromError or componentDidCatch' };
  }

  return { pass: true, code: 'EB004', message: usesReactErrorBoundary ? 'react-error-boundary used' : 'Class component with proper lifecycle methods' };
}
