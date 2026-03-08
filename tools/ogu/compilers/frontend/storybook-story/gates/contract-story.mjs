import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const RULES = [
  { id: 'default-story', description: 'A Default story must be exported', test: c => /export\s+const\s+Default/.test(c) },
  { id: 'no-hardcoded-data', description: 'Story args should use realistic but not hardcoded production data', test: c => !/password.*:.*['"].*['"]|token.*:.*['"][A-Za-z0-9]{20,}/.test(c) },
  { id: 'title-in-meta', description: 'Meta must include a title for Storybook sidebar organization', test: c => /title\s*:/.test(c) },
];

export async function run({ dir }) {
  const storyFiles = readdirSync(dir).filter(f => f.endsWith('.stories.tsx') || f.endsWith('.stories.ts'));
  if (!storyFiles.length) return { pass: false, code: 'SB008', message: 'No stories file found' };
  const content = readFileSync(join(dir, storyFiles[0]), 'utf8');
  const violations = RULES.filter(r => !r.test(content));
  if (violations.length) return { pass: false, code: 'SB008', message: `Contract violations: ${violations.map(v => v.id).join(', ')}`, detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n') };
  return { pass: true, code: 'SB008', message: 'All story contract rules passed' };
}
