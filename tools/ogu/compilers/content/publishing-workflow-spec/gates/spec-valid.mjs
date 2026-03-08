import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** PWS001 — spec-valid: spec file exists, is valid JSON, and has required structure */
export async function run({ dir }) {
  const specPath = join(dir, 'publishing-workflow-spec.spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false,
      code: 'PWS001',
      message: 'publishing-workflow-spec.spec.json not found',
      detail: `Expected file at: ${specPath}`,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'PWS001',
      message: 'publishing-workflow-spec.spec.json is not valid JSON',
      detail: err.message,
    };
  }

  const missing = [];
  if (!Array.isArray(spec.states) || spec.states.length === 0) missing.push('states (non-empty array)');
  if (!spec.initialState) missing.push('initialState');
  if (!spec.roles || typeof spec.roles !== 'object') missing.push('roles (object)');

  if (missing.length > 0) {
    return {
      pass: false,
      code: 'PWS001',
      message: `Spec missing required fields: ${missing.join(', ')}`,
    };
  }

  // Validate each state has id and transitions
  const violations = [];
  for (const state of spec.states) {
    if (!state.id) violations.push(`State missing id: ${JSON.stringify(state).slice(0, 60)}`);
    if (!state.transitions || typeof state.transitions !== 'object') {
      violations.push(`State "${state.id || '?'}": missing transitions object`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'PWS001',
      message: `${violations.length} state structural violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'PWS001',
    message: `Spec valid — ${spec.states.length} workflow state(s)`,
  };
}
