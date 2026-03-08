import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * DI009 — contract-ingestion
 * Verifies that ingestion scripts satisfy the data ingestion contract:
 * pathlib paths, logging module, schema validation, and main guard.
 *
 * Why:
 * - Contract gates enforce architectural invariants that cannot be expressed
 *   as individual rule gates. They provide a final "does this meet the bar?"
 *   summary check that covers the core non-negotiable patterns.
 * - pathlib over string concatenation: prevents path separator bugs on Windows,
 *   makes paths composable and inspectable without regex parsing.
 * - logging over print: structured logs can be filtered, aggregated, and
 *   monitored in production; print output cannot.
 * - Schema validation at ingestion boundary: errors caught at entry save
 *   hours of debugging downstream model failures caused by bad data.
 * - main guard: prevents side effects when the script is imported as a module.
 *
 * Escape hatch: none — these are non-negotiable contract requirements.
 */

const RULES = [
  {
    id: 'uses-pathlib',
    description: 'pathlib.Path used for file paths (not raw string concatenation)',
    test: c => /from pathlib import|import pathlib/.test(c),
  },
  {
    id: 'has-logging',
    description: 'logging module configured (not print statements)',
    test: c => /import logging|from logging import|getLogger/.test(c),
  },
  {
    id: 'validates-schema',
    description: 'Schema validation present (pandera, great_expectations, or similar)',
    test: c => /pandera|great_expectations|DataFrameSchema|\.validate\s*\(/.test(c),
  },
  {
    id: 'has-main-guard',
    description: "if __name__ == '__main__': present (prevents import-time side effects)",
    test: c => /if __name__ == ['"]__main__['"]/.test(c),
  },
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) return { pass: false, code: 'DI009', message: 'No Python files found' };

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = RULES.filter(r => !r.test(content));

  if (violations.length) {
    return {
      pass: false, code: 'DI009',
      message: `Contract violations: ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n'),
    };
  }

  return { pass: true, code: 'DI009', message: 'All ingestion contract rules passed' };
}
