import { readFileSync, readdirSync } from 'fs'; import { join } from 'path';
export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx') && !f.endsWith('.test.ts'));
  if (!files.length) return { pass: false, code: 'EV006', message: 'No source file found' };
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  // Count variant branches — if > 4 variants in one file it's a smell
  const variantBranches = (content.match(/variant\s*===\s*['"`]\w+['"`]/g) || []).length;
  if (variantBranches > 5) {
    return { pass: false, code: 'EV006', message: `Branching sprawl: ${variantBranches} variant comparisons in source`, detail: 'More than 5 variant branches suggests splitting into separate components per variant' };
  }
  // Nested experiment checks (experiment inside experiment)
  const hasNestedExperiment = /useExperiment\s*\([^)]+\)[\s\S]{0,200}useExperiment\s*\(/.test(content);
  if (hasNestedExperiment) return { pass: false, code: 'EV006', message: 'Nested experiment variants detected — experiments must not be nested', detail: 'Compose experiment wrappers at the parent level, never nest feature flags inside variants' };
  return { pass: true, code: 'EV006', message: 'No branching sprawl detected' };
}
