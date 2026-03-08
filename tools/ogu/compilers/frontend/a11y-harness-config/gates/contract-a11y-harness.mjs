import { existsSync } from 'fs'; import { join } from 'path';
const RULES = [
  { id: 'has-axe', description: 'axe-core or jest-axe in package.json', test: (_, root) => {
    try { const pkg = JSON.parse(require('fs').readFileSync(join(root, 'package.json'), 'utf8')); const deps = {...pkg.dependencies,...pkg.devDependencies}; return 'axe-core' in deps || 'jest-axe' in deps || '@axe-core/react' in deps || 'vitest-axe' in deps; } catch { return false; }
  }},
];
import { readFileSync } from 'fs';
export async function run({ dir, projectRoot }) {
  const root = projectRoot || dir;
  const pkgPath = join(root, 'package.json');
  if (!existsSync(pkgPath)) return { pass: false, code: 'AH007', message: 'package.json not found' };
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const hasAxe = 'axe-core' in deps || 'jest-axe' in deps || '@axe-core/react' in deps || 'vitest-axe' in deps;
  if (!hasAxe) return { pass: false, code: 'AH007', message: 'Contract violation: no axe library in package.json', detail: '[has-axe] axe-core or jest-axe must be installed' };
  return { pass: true, code: 'AH007', message: 'All a11y-harness contract rules passed' };
}
