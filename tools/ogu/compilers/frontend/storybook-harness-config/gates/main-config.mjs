import { readFileSync, existsSync } from 'fs'; import { join } from 'path';
export async function run({ dir, projectRoot }) {
  const root = projectRoot || dir;
  const candidates = ['.storybook/main.ts', '.storybook/main.js', '.storybook/main.cjs'];
  const found = candidates.find(f => existsSync(join(root, f)));
  if (!found) return { pass: false, code: 'SBC002', message: '.storybook/main.ts not found', detail: 'Create .storybook/main.ts with framework and stories configuration' };
  const content = readFileSync(join(root, found), 'utf8');
  const hasFramework = /framework\s*:/.test(content);
  const hasStories = /stories\s*:/.test(content);
  if (!hasFramework) return { pass: false, code: 'SBC002', message: '.storybook/main.ts missing framework configuration' };
  if (!hasStories) return { pass: false, code: 'SBC002', message: '.storybook/main.ts missing stories glob' };
  return { pass: true, code: 'SBC002', message: `Storybook main config valid: ${found}` };
}
