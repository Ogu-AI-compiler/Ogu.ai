import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  const violations = [];

  for (const file of files) {
    const content = readFileSync(join(dir, file), 'utf8');
    if (/^import.*['"]react['"]/im.test(content) || /^import.*from\s+['"]react['"]/im.test(content)) {
      violations.push(`${file} imports React — utility functions must be framework-agnostic`);
    }
    if (/^import.*['"]next\//im.test(content)) {
      violations.push(`${file} imports Next.js — utility functions must be framework-agnostic`);
    }
  }

  if (violations.length) {
    return { pass: false, code: 'UF005', message: 'Framework imports found', detail: violations.join('\n') };
  }

  return { pass: true, code: 'UF005', message: 'No React/framework imports — utility is framework-agnostic' };
}
