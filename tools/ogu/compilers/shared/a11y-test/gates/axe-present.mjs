import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const testFiles = readdirSync(dir).filter(f => f.endsWith('.test.tsx') || f.endsWith('.test.ts') || f.endsWith('.spec.tsx') || f.endsWith('.spec.ts'));
  if (!testFiles.length) return { pass: false, code: 'A1002', message: 'No test file found — a11y tests require a test file' };

  const content = testFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  // Must import axe-core or vitest-axe
  const hasAxeImport = /from\s+['"]@axe-core\/|from\s+['"]vitest-axe['"]|from\s+['"]jest-axe['"]|require\(['"]axe-core['"]/.test(content);
  if (!hasAxeImport) {
    return { pass: false, code: 'A1002', message: 'axe-core not imported — add: import { axe } from "vitest-axe"' };
  }

  // Must call toHaveNoViolations() or checkA11y()
  const hasViolationsCheck = /toHaveNoViolations\s*\(\s*\)|checkA11y\s*\(|expect\s*\(\s*results?\s*\)/.test(content);
  if (!hasViolationsCheck) {
    return { pass: false, code: 'A1002', message: 'axe-core test not found — accessibility tests require toHaveNoViolations()' };
  }

  return { pass: true, code: 'A1002', message: 'axe-core imported and toHaveNoViolations() assertion found' };
}
