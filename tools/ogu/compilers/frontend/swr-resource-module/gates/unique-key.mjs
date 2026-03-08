import { readFileSync, readdirSync } from 'fs'; import { join } from 'path';
export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));
  if (!files.length) return { pass: false, code: 'SW004', message: 'No source file found' };
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const hasSwr = /useSWR\s*\(/.test(content);
  if (!hasSwr) return { pass: false, code: 'SW004', message: 'No useSWR() call found — SWR resource module must use useSWR' };
  // Detect plain string literal keys (not parameterized)
  const staticKey = /useSWR\s*\(\s*['"`][^'"`]+['"`]\s*,/.test(content);
  const dynamicKey = /useSWR\s*\(\s*(?:\[|\`|\w+\s*\?|\w+\s*&&|\(\))/.test(content);
  if (staticKey && !dynamicKey) return { pass: false, code: 'SW004', message: 'SWR key is a plain string literal — keys should be unique and parameterized', detail: 'Use template literal or array key: useSWR(["/api/resource", id], fetcher)' };
  return { pass: true, code: 'SW004', message: 'SWR key is parameterized/unique' };
}
