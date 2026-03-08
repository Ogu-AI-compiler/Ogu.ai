import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const CONTRACT_RULES = [
  { id: 'loading-before-redirect', description: 'Must show loading state before redirecting', test: c => /isLoading|isPending/.test(c) },
  { id: 'replace-on-redirect', description: 'Redirect must use replace:true to not pollute history', test: c => /replace.*true|replace\s*\/>/i.test(c) },
  { id: 'children-or-outlet', description: 'Must render children or <Outlet /> when authenticated', test: c => /\{children\}|<Outlet/.test(c) },
  { id: 'no-hardcoded-user', description: 'Must not check a hardcoded user object — use auth hook', test: c => !/user\s*===\s*\{|user\s*==\s*\{/.test(c) },
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.tsx') && !f.endsWith('.test.tsx'));
  if (!files.length) return { pass: false, code: 'RG011', message: 'No guard file found' };
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = CONTRACT_RULES.filter(r => !r.test(content));
  if (violations.length) return { pass: false, code: 'RG011', message: `Contract violations: ${violations.map(v => v.id).join(', ')}`, detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n') };
  return { pass: true, code: 'RG011', message: 'All guard contract rules passed' };
}
