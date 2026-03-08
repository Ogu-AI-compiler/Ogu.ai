import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const RULES = [
  { id: 'describe-block', description: 'Tests wrapped in describe()', test: c => /describe\s*\(/.test(c) },
  { id: 'has-assertions', description: 'Has at least one expect()', test: c => /expect\s*\(/.test(c) },
  { id: 'no-only', description: 'No .only() calls (blocks other tests)', test: c => !/(it|test|describe)\.only\s*\(/.test(c) },
  { id: 'no-skip', description: 'No .skip() calls left in committed code', test: c => !/(it|test|describe)\.skip\s*\(/.test(c) },
  { id: 'render-cleanup', description: 'Uses cleanup or renderResult for React tests', test: c => !/render\s*\(/.test(c) || /cleanup|unmount|afterEach/.test(c) },
];

export async function run({ dir }) {
  const testFiles = readdirSync(dir).filter(f => f.endsWith('.test.tsx') || f.endsWith('.test.ts') || f.endsWith('.spec.tsx') || f.endsWith('.spec.ts'));
  if (!testFiles.length) return { pass: false, code: 'UT008', message: 'No test file found' };
  const content = testFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = RULES.filter(r => !r.test(content));
  if (violations.length) {
    return {
      pass: false, code: 'UT008',
      message: `Contract violations: ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n')
    };
  }
  return { pass: true, code: 'UT008', message: 'All unit-test contract rules passed' };
}
