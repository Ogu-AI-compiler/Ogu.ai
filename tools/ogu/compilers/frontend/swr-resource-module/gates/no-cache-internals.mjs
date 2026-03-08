import { readFileSync, readdirSync } from 'fs'; import { join } from 'path';
export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));
  if (!files.length) return { pass: false, code: 'SW006', message: 'No source file found' };
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  // Direct cache manipulation anti-patterns
  const hasCacheAccess = /\.cache\s*\[|cache\.set\s*\(|cache\.delete\s*\(|mutate\s*\(\s*undefined\s*,\s*undefined\s*\)/.test(content);
  const hasInternalApi = /useSWRConfig\s*\(\s*\).*\.cache|SWRConfig.*cache\s*=/.test(content);
  if (hasCacheAccess || hasInternalApi) return { pass: false, code: 'SW006', message: 'Direct SWR cache manipulation detected', detail: 'Use mutate() API instead of accessing cache internals directly' };
  return { pass: true, code: 'SW006', message: 'No direct cache internal access' };
}
