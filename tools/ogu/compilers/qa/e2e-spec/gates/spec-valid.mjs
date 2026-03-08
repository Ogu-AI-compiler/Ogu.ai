import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * QA020 — spec-valid
 * e2e-spec.json must exist and contain all required fields.
 */

const VALID_FRAMEWORKS = ['playwright', 'cypress', 'webdriverio', 'puppeteer'];

export async function run({ dir }) {
  const specPath = join(dir, 'e2e-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'QA020', message: 'e2e-spec.json not found' };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'QA020', message: `Invalid JSON: ${e.message}` };
  }

  if (!spec.framework) {
    return { pass: false, code: 'QA020', message: 'framework not declared' };
  }
  if (!VALID_FRAMEWORKS.includes(spec.framework)) {
    return {
      pass: false, code: 'QA020',
      message: `framework "${spec.framework}" not recognised — must be one of: ${VALID_FRAMEWORKS.join(', ')}`,
    };
  }

  if (!spec.baseUrl || typeof spec.baseUrl !== 'string') {
    return { pass: false, code: 'QA020', message: 'baseUrl not declared' };
  }

  if (!Array.isArray(spec.userFlows) || spec.userFlows.length === 0) {
    return { pass: false, code: 'QA020', message: 'userFlows[] is empty — at least one user flow required' };
  }

  // Validate each flow has id, name, routesCovered
  const invalid = [];
  for (const flow of spec.userFlows) {
    if (!flow.id) invalid.push(`Flow missing id`);
    if (!flow.name) invalid.push(`Flow "${flow.id || '?'}" missing name`);
    if (!Array.isArray(flow.routesCovered) || flow.routesCovered.length === 0) {
      invalid.push(`Flow "${flow.id || '?'}" has no routesCovered`);
    }
  }

  if (invalid.length) {
    return { pass: false, code: 'QA020', message: `Invalid flows: ${invalid.slice(0, 5).join('; ')}` };
  }

  return {
    pass: true, code: 'QA020',
    message: `Spec valid — framework: ${spec.framework}, ${spec.userFlows.length} flow(s)`,
  };
}
