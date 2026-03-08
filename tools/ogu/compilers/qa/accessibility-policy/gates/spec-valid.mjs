import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA070 — spec-valid
 * accessibility-policy-spec.json must declare:
 *   - tool: the automated accessibility testing tool
 *   - wcagLevel: WCAG conformance level (A, AA, AAA)
 *   - wcagVersion: WCAG version (2.0, 2.1, 2.2)
 *   - ciEnforcement: how violations affect CI
 *   - scope: what is being tested (pages, components, or both)
 *
 * Valid tools: axe-core, pa11y, lighthouse, wave, deque-axe, playwright-axe, cypress-axe
 */

const VALID_TOOLS = new Set([
  'axe-core', 'pa11y', 'lighthouse', 'wave', 'deque-axe',
  'playwright-axe', 'cypress-axe', 'jest-axe', 'storybook-a11y',
]);
const VALID_LEVELS = new Set(['A', 'AA', 'AAA']);
const VALID_VERSIONS = new Set(['2.0', '2.1', '2.2']);

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'accessibility-policy-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA070', message: 'accessibility-policy-spec.json not found or not valid JSON' }; }

  if (!spec.tool || !VALID_TOOLS.has(spec.tool)) {
    return {
      pass: false, code: 'QA070',
      message: `spec.tool "${spec.tool ?? 'undefined'}" not valid`,
      detail: `Valid tools: ${[...VALID_TOOLS].join(', ')}`,
    };
  }

  if (!spec.wcagLevel || !VALID_LEVELS.has(spec.wcagLevel)) {
    return {
      pass: false, code: 'QA070',
      message: `spec.wcagLevel "${spec.wcagLevel ?? 'undefined'}" not valid — must be A, AA, or AAA`,
    };
  }

  if (!spec.wcagVersion || !VALID_VERSIONS.has(String(spec.wcagVersion))) {
    return {
      pass: false, code: 'QA070',
      message: `spec.wcagVersion "${spec.wcagVersion ?? 'undefined'}" not valid — must be 2.0, 2.1, or 2.2`,
    };
  }

  if (!spec.ciEnforcement || typeof spec.ciEnforcement !== 'object') {
    return { pass: false, code: 'QA070', message: 'spec.ciEnforcement is required (object with failOn)' };
  }

  const scope = spec.scope;
  if (!scope || (!scope.pages && !scope.components && !scope.routes)) {
    return {
      pass: false, code: 'QA070',
      message: 'spec.scope must declare pages, routes, or components to test',
    };
  }

  return {
    pass: true, code: 'QA070',
    message: `Spec valid — ${spec.tool}, WCAG ${spec.wcagVersion} Level ${spec.wcagLevel}`,
  };
}
