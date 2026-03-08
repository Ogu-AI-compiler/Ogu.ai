import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA003 — coverage-provider-explicit
 * coverage.provider must be explicitly set to 'v8' or 'istanbul'.
 * Leaving it unset means the runner picks a default that may change across versions,
 * causing coverage numbers to shift without code changes.
 *
 * Also enforces:
 * - coverage.include is not empty (otherwise no files are measured)
 * - coverage.include does not contain test files (tests measuring themselves inflates numbers)
 */

const VALID_PROVIDERS = ['v8', 'istanbul', 'babel'];

export async function run({ dir }) {
  let spec;
  try {
    spec = JSON.parse(readFileSync(join(dir, 'test-harness-spec.json'), 'utf8'));
  } catch {
    return { pass: false, code: 'QA003', message: 'test-harness-spec.json not readable' };
  }

  const cov = spec.coverage || {};

  if (!cov.provider) {
    return {
      pass: false, code: 'QA003',
      message: 'coverage.provider not set — must be "v8" or "istanbul"',
      detail: 'v8: faster, native runtime coverage. istanbul: more accurate branch coverage for TypeScript decorators.',
    };
  }

  if (!VALID_PROVIDERS.includes(cov.provider)) {
    return {
      pass: false, code: 'QA003',
      message: `coverage.provider "${cov.provider}" is not valid — must be one of: ${VALID_PROVIDERS.join(', ')}`,
    };
  }

  // Verify include array is non-empty
  if (!cov.include || !Array.isArray(cov.include) || cov.include.length === 0) {
    return {
      pass: false, code: 'QA003',
      message: 'coverage.include is empty — no source files will be measured for coverage',
      detail: 'Set coverage.include to patterns like ["src/**/*.ts", "src/**/*.tsx"]',
    };
  }

  // Detect test files accidentally included in coverage
  const testPatternsInInclude = cov.include.filter(p =>
    /\.(test|spec)\.|__tests__/.test(p)
  );
  if (testPatternsInInclude.length > 0) {
    return {
      pass: false, code: 'QA003',
      message: `coverage.include contains test file patterns — test files should not be measured: ${testPatternsInInclude.join(', ')}`,
      detail: 'Test files executing their own code inflates coverage numbers artificially. Remove these patterns and add them to coverage.exclude instead.',
    };
  }

  return {
    pass: true, code: 'QA003',
    message: `coverage.provider "${cov.provider}" — include: ${cov.include.length} pattern(s)`,
  };
}
