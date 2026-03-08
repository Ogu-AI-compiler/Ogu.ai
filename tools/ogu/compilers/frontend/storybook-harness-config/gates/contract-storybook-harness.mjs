import { existsSync } from 'fs'; import { join } from 'path';
const RULES = [
  { id: 'has-main', description: '.storybook/main.ts exists', test: (_, root) => existsSync(join(root, '.storybook/main.ts')) || existsSync(join(root, '.storybook/main.js')) },
  { id: 'has-preview', description: '.storybook/preview.ts exists', test: (_, root) => existsSync(join(root, '.storybook/preview.ts')) || existsSync(join(root, '.storybook/preview.js')) },
];
export async function run({ dir, projectRoot }) {
  const root = projectRoot || dir;
  const violations = RULES.filter(r => !r.test(null, root));
  if (violations.length) return { pass: false, code: 'SBC006', message: `Contract violations: ${violations.map(v => v.id).join(', ')}`, detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n') };
  return { pass: true, code: 'SBC006', message: 'All storybook-harness contract rules passed' };
}
