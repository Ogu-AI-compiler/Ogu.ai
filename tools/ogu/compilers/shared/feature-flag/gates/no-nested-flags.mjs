import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'flag-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'FF006', message: 'flag-spec.json not found' };

  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  const flagNames = (spec.flags || []).map(f => f.name);

  const files = readdirSync(dir).filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));
  if (!files.length) return { pass: true, code: 'FF006', message: 'No source files to check' };

  const violations = [];

  for (const file of files) {
    const content = readFileSync(join(dir, file), 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Detect: useFlag('flag-a') used inside an if-block that already checks useFlag('flag-b')
      // Simpler heuristic: check if a flag lookup appears inside a conditional that references another flag
      const flagCalls = flagNames.filter(name => line.includes(`'${name}'`) || line.includes(`"${name}"`));
      if (flagCalls.length > 1) {
        violations.push(`${file}:${i + 1} — multiple flags evaluated on same line: ${flagCalls.join(', ')}`);
      }
    }

    // Check for useFlag inside a ternary/logical that itself is inside an if(useFlag(...))
    for (const flagName of flagNames) {
      const nestedRe = new RegExp(`useFlag\\(['"]${flagName}['"]\\)[^\\n]*useFlag\\(`, 'g');
      if (nestedRe.test(content)) {
        violations.push(`${file}: flag '${flagName}' evaluated inline with another flag (nested evaluation)`);
      }
    }
  }

  if (violations.length) {
    return { pass: false, code: 'FF006', message: `Nested flag evaluation detected`, detail: violations.slice(0, 5).join('\n') };
  }

  return { pass: true, code: 'FF006', message: 'No nested flag dependencies detected' };
}
