import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const RULES = [
  { id: 'parse-exported', description: 'parse() must be exported', test: c => /export\s+(function|const)\s+parse/.test(c) },
  { id: 'serialize-exported', description: 'serialize() must be exported', test: c => /export\s+(function|const)\s+serialize/.test(c) },
  { id: 'typed-schema', description: 'Param schema must be typed (interface or type)', test: c => /interface\s+\w+Params|type\s+\w+Params\s*=/.test(c) },
  { id: 'no-any', description: 'No any in parse/serialize types', test: c => !/:\s*any\b/.test(c) },
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  if (!files.length) return { pass: false, code: 'USP009', message: 'No source file found' };
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = RULES.filter(r => !r.test(content));
  if (violations.length) return { pass: false, code: 'USP009', message: `Contract violations: ${violations.map(v => v.id).join(', ')}`, detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n') };
  return { pass: true, code: 'USP009', message: 'All searchparams contract rules passed' };
}
