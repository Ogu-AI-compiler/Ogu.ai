import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx') && !f.endsWith('.test.ts'));
  if (!files.length) return { pass: false, code: 'NC006', message: 'No navigation source file found' };

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  const violations = [];

  // Must have role="navigation" or <nav> element
  if (!/role=["']navigation["']|<nav[\s>]/.test(content)) {
    violations.push('Missing role="navigation" or <nav> — required for landmark navigation');
  }

  // Must not use onClick-only divs without keyboard handler for nav items
  const hasClickDivWithoutKey = /<div[^>]+onClick[^>]*>(?![\s\S]*?onKeyDown)/.test(content);
  if (hasClickDivWithoutKey) {
    violations.push('onClick on <div> without onKeyDown — use <a> or <button> for nav items');
  }

  // Nav links should use <a> or <Link> not <div onClick>
  const usesLinkElement = /<a\s|<Link\s|<NavLink\s/.test(content);
  if (!usesLinkElement) {
    violations.push('No <a>, <Link>, or <NavLink> elements — nav items must be native links for keyboard/screen reader support');
  }

  if (violations.length) {
    return { pass: false, code: 'NC006', message: `Keyboard accessibility issues`, detail: violations.join('\n') };
  }

  return { pass: true, code: 'NC006', message: '<nav> with <Link> elements and keyboard support present' };
}
