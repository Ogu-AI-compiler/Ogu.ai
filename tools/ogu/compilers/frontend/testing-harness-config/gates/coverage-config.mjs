import { readFileSync, existsSync } from 'fs'; import { join } from 'path';
export async function run({ dir, projectRoot }) {
  const root = projectRoot || dir;
  const candidates = ['vitest.config.ts', 'vitest.config.js', 'vite.config.ts', 'jest.config.ts', 'jest.config.js'];
  const contents = candidates.filter(f => existsSync(join(root, f))).map(f => readFileSync(join(root, f), 'utf8')).join('\n');
  const hasCoverage = /coverage\s*:|collectCoverage|--coverage/.test(contents);
  if (!hasCoverage) return { pass: false, code: 'TC004', message: 'Coverage not configured', detail: 'Add coverage: { reporter: ["text","lcov"], thresholds: { lines: 80 } } to vitest/jest config' };
  const hasThreshold = /threshold|branches|functions|lines|statements/.test(contents);
  if (!hasThreshold) return { pass: false, code: 'TC004', message: 'Coverage configured but no thresholds set', detail: 'Add thresholds to enforce minimum coverage' };
  return { pass: true, code: 'TC004', message: 'Coverage configured with thresholds' };
}
