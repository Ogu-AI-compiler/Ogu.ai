import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const CONTRACT_RULES = [
  { id: 'axe-import', description: 'Must import axe from vitest-axe, jest-axe, or @axe-core', test: c => /from\s+['"]vitest-axe['"]|from\s+['"]jest-axe['"]|from\s+['"]@axe-core/.test(c) },
  { id: 'no-violations-assertion', description: 'Must assert toHaveNoViolations()', test: c => /toHaveNoViolations\s*\(\s*\)/.test(c) },
  { id: 'render-in-test', description: 'Component must be rendered with render() in the test', test: c => /render\s*\(</.test(c) },
  { id: 'keyboard-test', description: 'Must include at least one keyboard interaction test', test: c => /fireEvent\.keyDown|userEvent\.keyboard|userEvent\.tab/.test(c) },
  { id: 'aria-assertions', description: 'Should assert ARIA attributes (role, aria-label, aria-*, getByRole)', test: c => /getByRole|getByLabelText|aria-label|toHaveAttribute\(['"]aria-/.test(c) },
];

export async function run({ dir }) {
  const testFiles = readdirSync(dir).filter(f => f.endsWith('.test.tsx') || f.endsWith('.test.ts') || f.endsWith('.spec.tsx'));
  if (!testFiles.length) return { pass: false, code: 'A1008', message: 'No test file found' };
  const content = testFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = CONTRACT_RULES.filter(r => !r.test(content));
  if (violations.length) return { pass: false, code: 'A1008', message: `Contract violations: ${violations.map(v => v.id).join(', ')}`, detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n') };
  return { pass: true, code: 'A1008', message: 'All a11y contract rules passed' };
}
