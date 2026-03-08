import { readFileSync, existsSync } from 'fs'; import { join } from 'path';
export async function run({ dir, projectRoot }) {
  const root = projectRoot || dir;
  // Check vitest.config for setupFiles or globals
  const configCandidates = ['vitest.config.ts', 'vitest.config.js', 'jest.config.ts', 'jest.config.js', 'jest.setup.ts', 'jest.setup.js'];
  const contents = configCandidates.filter(f => existsSync(join(root, f))).map(f => readFileSync(join(root, f), 'utf8')).join('\n');
  const hasJestDom = /@testing-library\/jest-dom|jest-dom\/extend-expect|vitest\/globals/.test(contents);
  if (!hasJestDom) return { pass: false, code: 'TC003', message: '@testing-library/jest-dom not configured', detail: 'Add import "@testing-library/jest-dom" to vitest.config.ts setupFiles or jest.setup.ts' };
  return { pass: true, code: 'TC003', message: '@testing-library/jest-dom configured' };
}
