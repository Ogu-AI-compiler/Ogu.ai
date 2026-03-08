import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** UTS001 — spec-valid: typography-scale-spec.json exists with required fields */
export async function run({ dir }) {
  const specPath = join(dir, 'typography-scale-spec.json');

  if (!existsSync(specPath)) {
    return { pass: false, code: 'UTS001', message: 'typography-scale-spec.json not found', detail: `Expected at: ${specPath}` };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return { pass: false, code: 'UTS001', message: 'typography-scale-spec.json is not valid JSON', detail: err.message };
  }

  if (!spec.steps || !Array.isArray(spec.steps) || spec.steps.length === 0) {
    return { pass: false, code: 'UTS001', message: 'typography-scale-spec.json missing required field: steps (non-empty array)' };
  }

  return { pass: true, code: 'UTS001', message: `Spec valid — ${spec.steps.length} scale step(s)` };
}
