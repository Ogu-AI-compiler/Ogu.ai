import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * DP010 — contract-pipeline
 * Verifies that data pipeline scripts satisfy the pipeline contract:
 * pathlib paths, logging, schema boundary checks, and main guard.
 *
 * Why:
 * - Contract gates are the architectural "does it meet the bar?" check.
 *   Individual domain gates check specific issues; the contract gate
 *   checks that the overall module architecture is sound.
 * - pathlib prevents cross-platform path bugs and string concatenation errors.
 * - logging enables production observability — pipeline failures are debuggable
 *   only if they leave traces in a structured, queryable log system.
 * - Schema validation at both input and output boundaries prevents silent
 *   data corruption from propagating through the pipeline DAG.
 * - main guard ensures the pipeline script can be imported as a module
 *   without triggering execution (required for unit testing pipeline stages).
 *
 * Escape hatch: none — these are non-negotiable for production pipelines.
 */

const RULES = [
  {
    id: 'uses-pathlib',
    description: 'pathlib.Path used for file paths',
    test: c => /from pathlib import|import pathlib/.test(c),
  },
  {
    id: 'has-logging',
    description: 'logging module configured',
    test: c => /import logging|from logging import|getLogger/.test(c),
  },
  {
    id: 'schema-validated',
    description: 'Schema validated at boundary (pandera, great_expectations, or .validate())',
    test: c => /pandera|great_expectations|\.validate\s*\(/.test(c),
  },
  {
    id: 'has-main-guard',
    description: "if __name__ == '__main__': present",
    test: c => /if __name__ == ['"]__main__['"]/.test(c),
  },
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) return { pass: false, code: 'DP010', message: 'No Python files found' };

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = RULES.filter(r => !r.test(content));

  if (violations.length) {
    return {
      pass: false, code: 'DP010',
      message: `Contract violations: ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n'),
    };
  }

  return { pass: true, code: 'DP010', message: 'All pipeline contract rules passed' };
}
