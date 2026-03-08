import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const storyFiles = readdirSync(dir).filter(f => f.endsWith('.stories.tsx') || f.endsWith('.stories.ts'));
  if (!storyFiles.length) return { pass: false, code: 'SB005', message: 'No stories file found' };
  const content = readFileSync(join(dir, storyFiles[0]), 'utf8');

  // Check for a11y parameters
  const hasA11y = /parameters\s*:[\s\S]*?a11y/.test(content) || /a11y\s*:/.test(content);

  if (!hasA11y) {
    return {
      pass: false, code: 'SB005',
      message: 'a11y addon parameters not configured',
      detail: [
        "Add to default export:",
        "parameters: {",
        "  a11y: { config: { rules: [{ id: 'color-contrast', enabled: true }] } }",
        "}"
      ].join('\n')
    };
  }

  return { pass: true, code: 'SB005', message: 'a11y addon parameters configured' };
}
