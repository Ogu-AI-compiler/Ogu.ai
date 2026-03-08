import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA084 — deterministic-seed-defined
 * Test data generation must use deterministic seeds to ensure reproducibility.
 *
 * Non-deterministic test data causes:
 *   - Flaky tests that fail on specific random values (edge cases, nulls, long strings)
 *   - Impossible to reproduce failures locally from CI logs alone
 *   - Different behavior on first vs subsequent runs
 *   - Load tests that produce different throughput across runs (noise vs regression)
 *
 * Required: spec.seed with:
 *   - value: the seed value (integer, or "env" to read from ENV)
 *   - OR strategy: "fixed" | "per-run" (per-run uses current timestamp, logged for reproduction)
 *
 * Per-run seeds are acceptable only if the seed value is logged in test output,
 * enabling reproduction. Fully random seeds with no logging are rejected.
 */

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'test-data-policy-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA084', message: 'test-data-policy-spec.json not readable' }; }

  // Only relevant for factory/generated strategies
  const strategies = Array.isArray(spec.strategy) ? spec.strategy : (spec.strategy ? [spec.strategy] : []);
  const needsSeed = strategies.some(s => ['factories', 'generated', 'synthetic'].includes(s));

  if (!needsSeed) {
    return { pass: true, code: 'QA084', message: 'Strategy does not use generated data — seed not required', skipped: true };
  }

  const seed = spec.seed;
  if (!seed || typeof seed !== 'object') {
    return {
      pass: false, code: 'QA084',
      message: 'spec.seed not declared for factory/generated test data strategy',
      detail: 'Add:\n  "seed": { "value": 42 }  // fixed seed for reproducibility\nOR:\n  "seed": { "strategy": "per-run", "logged": true }  // per-run with logging',
    };
  }

  // Strategy: per-run must have logging
  if (seed.strategy === 'per-run' || seed.strategy === 'timestamp') {
    if (seed.logged !== true) {
      return {
        pass: false, code: 'QA084',
        message: 'seed.strategy "per-run" requires seed.logged: true — seed must appear in test output for reproduction',
        detail: 'Without logging the seed, CI failures cannot be reproduced locally.',
      };
    }
    return { pass: true, code: 'QA084', message: 'seed: per-run with logging — reproducible from logs' };
  }

  // Strategy: fully random (no value, no fixed strategy)
  if (seed.strategy === 'random' && !seed.logged) {
    return {
      pass: false, code: 'QA084',
      message: 'seed.strategy "random" without logging — failures are not reproducible',
    };
  }

  // Fixed seed: value required
  if (seed.value === undefined && !seed.strategy) {
    return { pass: false, code: 'QA084', message: 'seed.value or seed.strategy is required' };
  }

  const seedStr = seed.value !== undefined
    ? `fixed seed: ${seed.value}`
    : `strategy: ${seed.strategy}`;

  return { pass: true, code: 'QA084', message: `Deterministic seed declared — ${seedStr}` };
}
