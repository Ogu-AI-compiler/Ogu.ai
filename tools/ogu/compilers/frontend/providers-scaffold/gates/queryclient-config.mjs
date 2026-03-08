import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
  if (!files.length) return { pass: false, code: 'PR006', message: 'No providers file found' };

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  if (!content.includes('QueryClient')) {
    return { pass: true, code: 'PR006', message: 'No QueryClient in providers — skipping', skipped: true };
  }

  const violations = [];

  // QueryClient must be instantiated outside component (prevents re-creation on render)
  const queryClientInComponent = /function\s+\w+[^{]*\{[\s\S]*?new QueryClient/.test(content);
  if (queryClientInComponent) {
    violations.push('QueryClient instantiated inside component — move to module scope: const queryClient = new QueryClient()');
  }

  // Should have defaultOptions configured
  if (!content.includes('defaultOptions') && !content.includes('staleTime') && !content.includes('retry')) {
    violations.push('QueryClient missing defaultOptions — configure staleTime and retry at minimum');
  }

  if (violations.length) return { pass: false, code: 'PR006', message: 'QueryClient config issues', detail: violations.join('\n') };
  return { pass: true, code: 'PR006', message: 'QueryClient configured correctly' };
}
