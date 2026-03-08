import { readFileSync, readdirSync } from 'fs'; import { join } from 'path';
export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));
  if (!files.length) return { pass: false, code: 'SW005', message: 'No source file found' };
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const hasRevalidation = /revalidateOnFocus|revalidateOnReconnect|refreshInterval|revalidateIfStale|dedupingInterval/.test(content);
  if (!hasRevalidation) return { pass: false, code: 'SW005', message: 'SWR revalidation strategy not declared', detail: 'Add revalidateOnFocus, refreshInterval, or revalidateIfStale to useSWR options' };
  return { pass: true, code: 'SW005', message: 'SWR revalidation strategy declared' };
}
