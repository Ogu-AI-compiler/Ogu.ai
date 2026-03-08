import { readFileSync, existsSync, readdirSync } from 'fs'; import { join } from 'path';
export async function run({ dir, projectRoot }) {
  const root = projectRoot || dir;
  // Check storybook preview or axe config for WCAG level
  const candidates = ['.storybook/preview.ts', '.storybook/preview.js', 'axe.config.ts', 'axe.config.js', 'a11y.config.ts'];
  const contents = candidates.filter(f => existsSync(join(root, f))).map(f => readFileSync(join(root, f), 'utf8')).join('\n');
  // Also check in-dir config files
  const dirFiles = readdirSync(dir).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
  const dirContents = dirFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const allContents = contents + '\n' + dirContents;
  const hasWcag = /wcag2a|wcag2aa|wcag2aaa|wcag21a|wcag21aa|WCAG|wcag_level|runOnly.*wcag/.test(allContents);
  if (!hasWcag) return { pass: false, code: 'AH003', message: 'WCAG level not declared in a11y config', detail: 'Add runOnly: { type: "tag", values: ["wcag2aa"] } to axe config or declare wcag_level in a11y-harness-spec.json' };
  return { pass: true, code: 'AH003', message: 'WCAG level declared' };
}
