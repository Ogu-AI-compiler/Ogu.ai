import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const testFiles = readdirSync(dir).filter(f => f.endsWith('.test.tsx') || f.endsWith('.test.ts') || f.endsWith('.spec.tsx') || f.endsWith('.spec.ts'));
  if (!testFiles.length) return { pass: false, code: 'UT004', message: 'No test file found' };
  const content = testFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  // Shared mutable state at module level (outside describe/it/before*)
  const hasModuleLevelLet = /^let\s+\w+/m.test(content);
  const hasBeforeAll = /beforeAll\s*\(/.test(content);
  const hasAfterAll = /afterAll\s*\(/.test(content);
  const hasBeforeEach = /beforeEach\s*\(/.test(content);

  // beforeAll without afterAll is a leak risk
  if (hasBeforeAll && !hasAfterAll) {
    return {
      pass: false, code: 'UT004',
      message: 'beforeAll without afterAll — shared setup may leak between suites',
      detail: 'Add afterAll cleanup or move setup into beforeEach for isolation'
    };
  }

  // Module-level let without beforeEach reset is suspicious
  if (hasModuleLevelLet && !hasBeforeEach) {
    return {
      pass: false, code: 'UT004',
      message: 'Module-level mutable state without beforeEach reset — tests may share state',
      detail: 'Move variable declarations inside beforeEach or use const in each test'
    };
  }

  return { pass: true, code: 'UT004', message: 'No shared state issues detected' };
}
