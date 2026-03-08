import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const storyFiles = readdirSync(dir).filter(f => f.endsWith('.stories.tsx') || f.endsWith('.stories.ts'));
  if (!storyFiles.length) return { pass: false, code: 'SB004', message: 'No stories file found' };
  const content = readFileSync(join(dir, storyFiles[0]), 'utf8');

  // Check Meta type is used
  const hasMeta = /Meta\s*<|satisfies\s+Meta/.test(content);
  if (!hasMeta) return { pass: false, code: 'SB004', message: 'Default export not typed as Meta<typeof Component> — add: const meta: Meta<typeof MyComponent> = { component: MyComponent }' };

  // Check stories have args
  const stories = content.match(/export\s+const\s+(\w+)\s*:\s*Story/g) || [];
  const storiesWithoutArgs = stories.filter(s => {
    const storyName = s.match(/const\s+(\w+)/)?.[1];
    if (!storyName) return false;
    const storyBody = content.substring(content.indexOf(storyName));
    const bodyEnd = storyBody.indexOf('export const', 10);
    const body = bodyEnd > 0 ? storyBody.substring(0, bodyEnd) : storyBody.substring(0, 300);
    return !/args\s*:/.test(body) && !/render\s*:/.test(body);
  });

  if (storiesWithoutArgs.length) {
    return { pass: false, code: 'SB004', message: `Stories without args: ${storiesWithoutArgs.join(', ')} — each story needs args: {} or render: ()=>...` };
  }

  return { pass: true, code: 'SB004', message: 'Stories typed with Meta and StoryObj, args present' };
}
