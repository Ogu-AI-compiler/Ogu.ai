import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'utility-spec.json'), 'utf8'));
  const files = readdirSync(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));

  if (!files.length) return { pass: false, code: 'UF006', message: 'No utility function file found' };

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  // Check the named function is exported
  const fnName = spec.name;
  const isExported =
    new RegExp(`export\\s+function\\s+${fnName}\\b`).test(content) ||
    new RegExp(`export\\s+const\\s+${fnName}\\s*=`).test(content) ||
    new RegExp(`export\\s+\\{[^}]*\\b${fnName}\\b`).test(content);

  if (!isExported) {
    return {
      pass: false, code: 'UF006',
      message: `Function '${fnName}' is not exported`,
      detail: `Add: export function ${fnName}(...) or export const ${fnName} = (...) =>`
    };
  }

  return { pass: true, code: 'UF006', message: `Function '${fnName}' is exported` };
}
