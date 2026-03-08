import { readFileSync, readdirSync } from 'fs'; import { join } from 'path';
export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx') && !f.endsWith('.test.ts'));
  if (!files.length) return { pass: false, code: 'EV004', message: 'No source file found' };
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const hasFallback = /fallback|control|default.*variant|variant.*default|CONTROL|'control'|"control"/.test(content);
  if (!hasFallback) return { pass: false, code: 'EV004', message: 'No fallback/control variant defined', detail: 'Experiment wrapper must render the control (fallback) variant when no treatment is assigned' };
  const hasConditional = /variant\s*===|variant\s*!==|\?.+:|switch\s*\(\s*variant/.test(content);
  if (!hasConditional) return { pass: false, code: 'EV004', message: 'No variant conditional rendering — wrapper must branch on variant value' };
  return { pass: true, code: 'EV004', message: 'Fallback variant defined with conditional rendering' };
}
