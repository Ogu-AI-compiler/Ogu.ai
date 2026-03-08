import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const storyFiles = readdirSync(dir).filter(f => f.endsWith('.stories.tsx') || f.endsWith('.stories.ts'));
  if (!storyFiles.length) return { pass: false, code: 'SB003', message: 'No .stories.tsx file found' };

  const content = readFileSync(join(dir, storyFiles[0]), 'utf8');

  // CSF3: must have default export with component
  if (!/export\s+default\s*\{/.test(content) && !/export\s+default\s+\w+/.test(content)) {
    return { pass: false, code: 'SB003', message: 'Missing default export — CSF3 requires: export default { component: MyComponent }' };
  }

  // Must have at least one named story export
  const namedExports = content.match(/^export\s+const\s+\w+/gm) || [];
  if (!namedExports.length) {
    return { pass: false, code: 'SB003', message: 'No named story exports — each story must be: export const Default: Story = { args: {...} }' };
  }

  // CSF3 stories should use StoryObj<typeof Component> type
  const hasStoryObj = /StoryObj|Story\s*=\s*\{/.test(content);
  if (!hasStoryObj) {
    return { pass: false, code: 'SB003', message: 'Stories not typed as StoryObj<typeof Component> — add: type Story = StoryObj<typeof MyComponent>' };
  }

  return { pass: true, code: 'SB003', message: `CSF3 valid — default export + ${namedExports.length} named stories` };
}
