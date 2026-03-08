import { readFileSync, readdirSync, existsSync } from 'fs'; import { join } from 'path';
export async function run({ dir, projectRoot }) {
  const root = projectRoot || dir;
  // Check package.json for axe-core or jest-axe or @axe-core/react
  const pkgPath = join(root, 'package.json');
  if (!existsSync(pkgPath)) return { pass: false, code: 'AH002', message: 'package.json not found' };
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const hasAxe = 'axe-core' in deps || 'jest-axe' in deps || '@axe-core/react' in deps || 'vitest-axe' in deps;
  if (!hasAxe) return { pass: false, code: 'AH002', message: 'No axe library found in package.json', detail: 'Install: npm install -D jest-axe or vitest-axe or @axe-core/react' };
  // Check for usage in test files
  const testFiles = readdirSync(dir).filter(f => f.endsWith('.test.ts') || f.endsWith('.test.tsx') || f.endsWith('.spec.ts') || f.endsWith('.spec.tsx'));
  if (testFiles.length) {
    const content = testFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
    const hasAxeUsage = /axe|toHaveNoViolations|checkA11y/.test(content);
    if (!hasAxeUsage) return { pass: false, code: 'AH002', message: 'axe package installed but not used in tests', detail: 'Use expect(await axe(container)).toHaveNoViolations()' };
  }
  return { pass: true, code: 'AH002', message: 'axe a11y wrapper configured and used' };
}
