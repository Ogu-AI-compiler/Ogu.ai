import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Weak assertion patterns that don't actually verify behavior
const WEAK_PATTERNS = [
  { pattern: /expect\([^)]+\)\.toBeTruthy\(\)/, name: 'toBeTruthy()' },
  { pattern: /expect\([^)]+\)\.toBeFalsy\(\)/, name: 'toBeFalsy()' },
  { pattern: /expect\([^)]+\)\.toBeDefined\(\)/, name: 'toBeDefined() alone' },
  { pattern: /expect\(true\)\.toBe\(true\)/, name: 'expect(true).toBe(true)' },
  { pattern: /expect\(\d+\)\.toBeGreaterThan\(0\)/, name: 'toBeGreaterThan(0) on constant' },
];

export async function run({ dir }) {
  const testFiles = readdirSync(dir).filter(f => f.endsWith('.test.tsx') || f.endsWith('.test.ts') || f.endsWith('.spec.tsx') || f.endsWith('.spec.ts'));
  if (!testFiles.length) return { pass: false, code: 'UT005', message: 'No test file found' };
  const content = testFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  // Check for tests with no assertions at all
  const itBlocks = (content.match(/(?:it|test)\s*\(/g) || []).length;
  const expectCalls = (content.match(/expect\s*\(/g) || []).length;
  if (itBlocks > 0 && expectCalls === 0) {
    return { pass: false, code: 'UT005', message: `${itBlocks} test(s) with zero expect() calls`, detail: 'Every test must have at least one assertion' };
  }

  const weak = WEAK_PATTERNS.filter(({ pattern }) => pattern.test(content)).map(w => w.name);
  if (weak.length) {
    return {
      pass: false, code: 'UT005',
      message: `Weak assertions: ${weak.join(', ')}`,
      detail: 'Use precise matchers: toEqual, toHaveTextContent, toBeInTheDocument, toHaveBeenCalledWith'
    };
  }

  return { pass: true, code: 'UT005', message: 'Assertions are specific and meaningful' };
}
