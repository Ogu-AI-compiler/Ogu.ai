import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const CONTRACT_RULES = [
  { id: 'nav-landmark', description: 'Must use <nav> element or role="navigation"', test: c => /<nav[\s>]|role=["']navigation["']/.test(c) },
  { id: 'nav-items-typed', description: 'Nav items must be typed (NavItem interface)', test: c => /interface\s+Nav|type\s+Nav\w+\s*=|\bNavItem\b/.test(c) },
  { id: 'exported-nav', description: 'Navigation component must be exported', test: c => /export\s+(default|function|const)\s+\w*(Nav|Navigation|Sidebar|Menu|Breadcrumb)/.test(c) },
  { id: 'aria-current', description: 'Active item must set aria-current="page"', test: c => /aria-current/.test(c) },
  { id: 'accepts-items-prop', description: 'Navigation must accept items as props or config', test: c => /items\s*[?:]|NavItem\[\]|navItems/.test(c) },
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx') && !f.endsWith('.test.ts'));
  if (!files.length) return { pass: false, code: 'NC010', message: 'No navigation source file found' };
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = CONTRACT_RULES.filter(r => !r.test(content));
  if (violations.length) return { pass: false, code: 'NC010', message: `Contract violations: ${violations.map(v => v.id).join(', ')}`, detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n') };
  return { pass: true, code: 'NC010', message: 'All navigation contract rules passed' };
}
