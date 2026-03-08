import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA011 — thresholds-consistent
 * branches threshold must NOT exceed lines threshold.
 *
 * Reasoning: branch coverage requires every conditional path to be exercised.
 * If you cover 80 lines but only 60% of branches, the branch number is always
 * lower than or equal to the line number. Setting branches > lines in the spec
 * creates a logically impossible requirement — lines would pass before branches,
 * making the gate either always-fail or always-meaningless.
 *
 * Also checks: per-file thresholds don't exceed 100%.
 */

export async function run({ dir }) {
  let spec;
  try {
    spec = JSON.parse(readFileSync(join(dir, 'coverage-policy-spec.json'), 'utf8'));
  } catch {
    return { pass: false, code: 'QA011', message: 'coverage-policy-spec.json not readable' };
  }

  const g = spec.global || {};
  const { lines = 0, branches = 0, functions = 0, statements = 0 } = g;

  if (branches > lines) {
    return {
      pass: false, code: 'QA011',
      message: `branches (${branches}%) exceeds lines (${lines}%) — logically impossible`,
      detail: `Branch coverage counts every if/else/ternary path. It is structurally harder to achieve than line coverage, so branches ≤ lines always. Fix: set branches ≤ ${lines}`,
    };
  }

  // Per-file checks
  const perFile = spec.perFile || {};
  const overHundred = [];
  for (const [glob, thresholds] of Object.entries(perFile)) {
    for (const [metric, val] of Object.entries(thresholds)) {
      if (typeof val === 'number' && val > 100) {
        overHundred.push(`${glob}.${metric} = ${val} (> 100%)`);
      }
    }
  }
  if (overHundred.length) {
    return {
      pass: false, code: 'QA011',
      message: `Per-file thresholds exceed 100%: ${overHundred.join(', ')}`,
    };
  }

  return {
    pass: true, code: 'QA011',
    message: `Thresholds consistent — lines:${lines}% ≥ branches:${branches}%, functions:${functions}%, statements:${statements}%`,
  };
}
