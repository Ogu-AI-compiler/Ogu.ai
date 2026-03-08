import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// QueryClientProvider must wrap everything data-related
// ErrorBoundary must be outermost if present
const ORDER_RULES = [
  {
    outer: 'ErrorBoundary', inner: 'QueryClientProvider',
    rule: 'ErrorBoundary must wrap QueryClientProvider to catch query errors'
  },
  {
    outer: 'QueryClientProvider', inner: 'RouterProvider',
    rule: 'QueryClientProvider must wrap the Router so routes can use queries'
  },
  {
    outer: 'QueryClientProvider', inner: 'BrowserRouter',
    rule: 'QueryClientProvider must wrap BrowserRouter'
  },
];

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'providers-spec.json'), 'utf8'));
  const files = readdirSync(dir).filter(f => f.endsWith('.tsx') && !f.endsWith('.test.tsx'));
  if (!files.length) return { pass: false, code: 'PR004', message: 'No providers file found' };

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = [];

  for (const rule of ORDER_RULES) {
    const outerIdx = content.indexOf(`<${rule.outer}`);
    const innerIdx = content.indexOf(`<${rule.inner}`);
    if (outerIdx === -1 || innerIdx === -1) continue; // one not present, skip

    if (outerIdx > innerIdx) {
      violations.push(`Order violation: ${rule.rule}`);
    }
  }

  if (violations.length) return { pass: false, code: 'PR004', message: `Provider order violations (${violations.length})`, detail: violations.join('\n') };
  return { pass: true, code: 'PR004', message: 'Provider nesting order correct' };
}
