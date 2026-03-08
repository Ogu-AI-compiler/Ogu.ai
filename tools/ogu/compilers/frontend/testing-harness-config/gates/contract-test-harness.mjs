import { existsSync } from 'fs'; import { join } from 'path';
const RULES = [
  { id: 'has-config', description: 'vitest.config.ts or jest.config.ts exists', test: (_, root) => existsSync(join(root, 'vitest.config.ts')) || existsSync(join(root, 'vitest.config.js')) || existsSync(join(root, 'jest.config.ts')) || existsSync(join(root, 'jest.config.js')) },
  { id: 'has-setup', description: 'setupFiles or jest.setup.ts exists', test: (_, root) => existsSync(join(root, 'jest.setup.ts')) || existsSync(join(root, 'jest.setup.js')) || existsSync(join(root, 'vitest.setup.ts')) || existsSync(join(root, 'vitest.setup.js')) },
];
export async function run({ dir, projectRoot }) {
  const root = projectRoot || dir;
  const violations = RULES.filter(r => !r.test(null, root));
  if (violations.length) return { pass: false, code: 'TC006', message: `Contract violations: ${violations.map(v => v.id).join(', ')}`, detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n') };
  return { pass: true, code: 'TC006', message: 'All test-harness contract rules passed' };
}
