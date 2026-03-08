import { readFileSync, existsSync } from 'fs'; import { join } from 'path';
export async function run({ dir, projectRoot }) {
  const root = projectRoot || dir;
  const pkgPath = join(root, 'package.json');
  if (!existsSync(pkgPath)) return { pass: true, code: 'AH004', message: 'No package.json — storybook addon check skipped', skipped: true };
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const hasStorybook = Object.keys(deps).some(d => d.startsWith('@storybook/'));
  if (!hasStorybook) return { pass: true, code: 'AH004', message: 'Storybook not used — addon check skipped', skipped: true };
  const hasA11yAddon = '@storybook/addon-a11y' in deps;
  if (!hasA11yAddon) return { pass: false, code: 'AH004', message: 'Storybook used but @storybook/addon-a11y not installed', detail: 'npm install -D @storybook/addon-a11y' };
  return { pass: true, code: 'AH004', message: '@storybook/addon-a11y installed' };
}
