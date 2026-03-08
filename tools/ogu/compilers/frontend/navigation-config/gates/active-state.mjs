import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx') && !f.endsWith('.test.ts'));
  if (!files.length) return { pass: false, code: 'NC005', message: 'No navigation source file found' };

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  // Active state indicators
  const hasActiveState =
    /aria-current|isActive|active\s*:|NavLink|useMatch|useLocation|pathname.*===|location\.pathname/.test(content);

  if (!hasActiveState) {
    return {
      pass: false, code: 'NC005',
      message: 'No active-state logic found — use NavLink, useMatch(), or aria-current="page"',
      detail: 'Current page must be visually and semantically highlighted\nExample: <NavLink aria-current={isActive ? "page" : undefined}>'
    };
  }

  // Check aria-current is used for semantic active state (not just CSS class)
  const hasAriaCurrent = /aria-current/.test(content);
  if (!hasAriaCurrent) {
    return {
      pass: false, code: 'NC005',
      message: 'aria-current="page" missing on active nav item — required for screen reader users',
      detail: 'Add: aria-current={isCurrentPage ? "page" : undefined}'
    };
  }

  return { pass: true, code: 'NC005', message: 'Active state with aria-current present' };
}
