import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const CONTRACT_RULES = [
  {
    id: 'main-slot-required',
    description: "Layout must render a 'main' slot as the primary content area",
    test: (content) => /\{.*main.*\}|<main|role="main"/.test(content)
  },
  {
    id: 'semantic-html',
    description: 'Layout regions must use semantic HTML elements (header, nav, main, aside, footer)',
    test: (content) => /<header|<nav|<main|<footer|<aside/.test(content)
  },
  {
    id: 'skip-to-main',
    description: 'Layout should include a skip-to-main-content link for keyboard accessibility',
    test: (content) => /skip.*main|#main|#content/.test(content)
  },
  {
    id: 'no-fixed-px-width',
    description: 'Layout must not use fixed pixel widths — use max-w, container, or % units',
    test: (content) => !/width:\s*\d+px|w-\[\d+px\]/.test(content)
  }
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.tsx') && !f.endsWith('.test.tsx'));
  if (!files.length) return { pass: false, code: 'LC010', message: 'No layout file found' };

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = CONTRACT_RULES.filter(r => !r.test(content));

  if (violations.length) {
    return {
      pass: false, code: 'LC010',
      message: `Contract violations: ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n')
    };
  }

  return { pass: true, code: 'LC010', message: 'All layout contract rules passed' };
}
