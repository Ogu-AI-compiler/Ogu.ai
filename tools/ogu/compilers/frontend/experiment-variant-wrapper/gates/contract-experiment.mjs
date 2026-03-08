import { readFileSync, readdirSync } from 'fs'; import { join } from 'path';
const RULES = [
  { id: 'uses-hook', description: 'useExperiment or useFeatureFlag hook used', test: c => /useExperiment\s*\(|useFeatureFlag\s*\(|useVariant\s*\(/.test(c) },
  { id: 'has-fallback', description: 'Control/fallback variant handled', test: c => /fallback|control|CONTROL/.test(c) },
  { id: 'exposure-tracked', description: 'Exposure tracking present', test: c => /trackExposure|logExposure|recordExposure/.test(c) },
  { id: 'exported', description: 'Component/hook is exported', test: c => /export\s+(default\s+|function\s+|const\s+)/.test(c) },
];
export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx') && !f.endsWith('.test.ts'));
  if (!files.length) return { pass: false, code: 'EV010', message: 'No source file found' };
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = RULES.filter(r => !r.test(content));
  if (violations.length) return { pass: false, code: 'EV010', message: `Contract violations: ${violations.map(v => v.id).join(', ')}`, detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n') };
  return { pass: true, code: 'EV010', message: 'All experiment-variant contract rules passed' };
}
