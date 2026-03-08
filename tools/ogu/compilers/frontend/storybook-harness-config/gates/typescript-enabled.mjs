import { readFileSync, existsSync } from 'fs'; import { join } from 'path';
export async function run({ dir, projectRoot }) {
  const root = projectRoot || dir;
  const mainPath = ['.storybook/main.ts', '.storybook/main.js'].find(f => existsSync(join(root, f)));
  if (!mainPath) return { pass: false, code: 'SBC003', message: '.storybook/main.ts not found' };
  const content = readFileSync(join(root, mainPath), 'utf8');
  // TypeScript enabled if main is .ts OR if docs addon is configured with autodocs
  const isTs = mainPath.endsWith('.ts');
  const hasTypescript = /typescript\s*:|@storybook\/addon-essentials|@storybook\/.*typescript/.test(content);
  if (!isTs && !hasTypescript) return { pass: false, code: 'SBC003', message: 'Storybook main config is not TypeScript', detail: 'Rename main.js to main.ts and add typescript configuration' };
  return { pass: true, code: 'SBC003', message: 'TypeScript enabled in Storybook' };
}
