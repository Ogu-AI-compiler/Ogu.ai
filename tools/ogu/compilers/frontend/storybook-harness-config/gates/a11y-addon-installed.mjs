import { readFileSync, existsSync } from 'fs'; import { join } from 'path';
export async function run({ dir, projectRoot }) {
  const root = projectRoot || dir;
  // Check package.json
  const pkgPath = join(root, 'package.json');
  if (!existsSync(pkgPath)) return { pass: false, code: 'SBC004', message: 'package.json not found' };
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  const hasA11yAddon = '@storybook/addon-a11y' in allDeps;
  if (!hasA11yAddon) return { pass: false, code: 'SBC004', message: '@storybook/addon-a11y not installed', detail: 'Run: npm install -D @storybook/addon-a11y' };
  // Check it's registered in main config
  const mainPath = ['.storybook/main.ts', '.storybook/main.js'].find(f => existsSync(join(root, f)));
  if (mainPath) {
    const mainContent = readFileSync(join(root, mainPath), 'utf8');
    if (!/@storybook\/addon-a11y/.test(mainContent)) return { pass: false, code: 'SBC004', message: '@storybook/addon-a11y installed but not registered in .storybook/main.ts' };
  }
  return { pass: true, code: 'SBC004', message: '@storybook/addon-a11y installed and registered' };
}
