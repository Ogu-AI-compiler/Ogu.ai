import { readFileSync, existsSync } from 'fs'; import { join } from 'path';
export async function run({ dir, projectRoot }) {
  const root = projectRoot || dir;
  const candidates = ['vitest.config.ts', 'vitest.config.js', 'vite.config.ts', 'vite.config.js'];
  const found = candidates.find(f => existsSync(join(root, f)));
  if (!found) return { pass: false, code: 'TC002', message: 'No vitest.config.ts or vite.config.ts found', detail: 'Create vitest.config.ts with defineConfig({ test: { environment: "jsdom" } })' };
  const content = readFileSync(join(root, found), 'utf8');
  const hasTest = /\btest\s*:/.test(content);
  if (!hasTest) return { pass: false, code: 'TC002', message: `${found} has no test configuration block` };
  return { pass: true, code: 'TC002', message: `Vitest config found: ${found}` };
}
