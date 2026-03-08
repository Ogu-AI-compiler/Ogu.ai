import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const CONTRACT_RULES = [
  { id: 'typed-flags', description: 'Flag definitions must use TypeScript types/interfaces', test: c => /interface\s+\w*Flag|type\s+\w*Flag\s*=|FeatureFlag/.test(c) },
  { id: 'exported-flags', description: 'Flag constants/map must be exported', test: c => /export\s+(const|function|type)\s+\w*(flag|Flag|flags|Flags)/.test(c) },
  { id: 'use-flag-hook', description: 'Must expose useFlag() hook or getFlag() function for consumption', test: c => /export\s+(function|const)\s+(useFlag|getFlag|isEnabled)/.test(c) },
  { id: 'default-value', description: 'Every flag access must fall back to defaultValue', test: c => /defaultValue|fallback|default\s*[=:]/.test(c) },
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx') && !f.endsWith('.test.ts'));
  if (!files.length) return { pass: false, code: 'FF009', message: 'No feature flag file found' };
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = CONTRACT_RULES.filter(r => !r.test(content));
  if (violations.length) return { pass: false, code: 'FF009', message: `Contract violations: ${violations.map(v => v.id).join(', ')}`, detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n') };
  return { pass: true, code: 'FF009', message: 'All feature flag contract rules passed' };
}
