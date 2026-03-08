import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  if (!files.length) return { pass: false, code: 'USP004', message: 'No source file found' };
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  // parse function must exist
  if (!/export\s+(function|const)\s+parse/.test(content))
    return { pass: false, code: 'USP004', message: 'No exported parse() function found' };

  // Must not have unguarded throws in parse path
  const hasThrow = /function\s+parse[\s\S]{0,500}throw\s+new/.test(content);
  const hasTryCatch = /function\s+parse[\s\S]{0,500}try\s*\{/.test(content);
  const hasNullish = /\?\?|null|undefined|fallback|default/.test(content);

  if (hasThrow && !hasTryCatch && !hasNullish) {
    return {
      pass: false, code: 'USP004',
      message: 'parse() can throw — wrap in try/catch and return safe fallback',
      detail: 'parse() must be total: every input returns a valid result or typed error, never throws'
    };
  }

  return { pass: true, code: 'USP004', message: 'parse() is total (no unguarded throws)' };
}
