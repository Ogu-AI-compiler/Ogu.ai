import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  if (!files.length) return { pass: false, code: 'USP005', message: 'No source file found' };
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  if (!/export\s+(function|const)\s+serialize/.test(content))
    return { pass: false, code: 'USP005', message: 'No exported serialize() function found' };

  // Non-deterministic values = non-canonical
  const hasRandom = /Math\.random|Date\.now\(\)|new Date\(\)/.test(content);
  if (hasRandom) {
    return { pass: false, code: 'USP005', message: 'serialize() uses non-deterministic value — same input must always produce same URL' };
  }

  // Should sort keys or have a stable order
  const hasSortOrStable = /\.sort\(|Object\.keys.*sort|URLSearchParams|entries\(\)/.test(content);
  if (!hasSortOrStable) {
    return {
      pass: false, code: 'USP005',
      message: 'serialize() key order not guaranteed — use URLSearchParams or explicit sort for canonical output',
      detail: 'Non-canonical URLs cause rerender loops when compared as strings'
    };
  }

  return { pass: true, code: 'USP005', message: 'serialize() is canonical' };
}
