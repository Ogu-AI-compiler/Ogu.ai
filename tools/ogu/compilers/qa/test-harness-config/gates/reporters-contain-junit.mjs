import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA005 — reporters-contain-junit
 * reporters array must include 'junit' (or equivalent).
 * JUnit XML is the universal format that CI systems (GitHub Actions, Jenkins,
 * GitLab CI, CircleCI) use to ingest test results, annotate PRs, and track
 * flaky tests over time.
 *
 * Without junit output, CI sees only pass/fail — not which tests failed or
 * how long they took.
 *
 * Accepts: 'junit', 'junit-xml', '@vitest/reporter-junit',
 *          'jest-junit', 'vitest-junit', 'mocha-junit-reporter'
 */

const JUNIT_ALIASES = new Set([
  'junit',
  'junit-xml',
  'jest-junit',
  'vitest-junit',
  '@vitest/reporter-junit',
  'mocha-junit-reporter',
  'jasmine-junit-reporter',
]);

export async function run({ dir }) {
  let spec;
  try {
    spec = JSON.parse(readFileSync(join(dir, 'test-harness-spec.json'), 'utf8'));
  } catch {
    return { pass: false, code: 'QA005', message: 'test-harness-spec.json not readable' };
  }

  const reporters = spec.reporters || [];
  if (!Array.isArray(reporters) || reporters.length === 0) {
    return {
      pass: false, code: 'QA005',
      message: 'reporters array is empty — CI cannot ingest test results',
    };
  }

  // Reporters can be strings or [name, options] tuples
  const reporterNames = reporters.map(r => (Array.isArray(r) ? r[0] : r)).filter(Boolean);

  const hasJunit = reporterNames.some(name => JUNIT_ALIASES.has(name));
  if (!hasJunit) {
    return {
      pass: false, code: 'QA005',
      message: `reporters [${reporterNames.join(', ')}] does not include a JUnit reporter`,
      detail: `Add one of: ${[...JUNIT_ALIASES].join(', ')}\nWithout JUnit, CI systems cannot display per-test results or track flaky tests.`,
    };
  }

  return {
    pass: true, code: 'QA005',
    message: `JUnit reporter present — reporters: [${reporterNames.join(', ')}]`,
  };
}
