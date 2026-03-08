/**
 * Gate: spec-valid (PR001)
 * Validates that prometheus-rules-spec.json exists, is valid JSON, and declares
 * a non-empty groups array. An empty or malformed spec means no alerts are loaded,
 * leaving the service unmonitored with no indication that monitoring failed.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'prometheus-rules-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'PR001',
      message: 'prometheus-rules-spec.json not found',
      detail: { searched: specPath, hint: 'Create prometheus-rules-spec.json with a groups array of alert/recording rule groups' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'PR001', message: `prometheus-rules-spec.json is not valid JSON: ${e.message}` };
  }

  if (!Array.isArray(spec.groups) || spec.groups.length === 0) {
    return {
      pass: false, code: 'PR001',
      message: 'groups must be a non-empty array',
      detail: {
        received: spec.groups,
        hint:     'Required structure: { groups: [{ name: "group-name", rules: [{ alert?, expr, labels, annotations? }] }] }',
      },
    };
  }

  return { pass: true, code: 'PR001', message: `prometheus-rules-spec.json valid — ${spec.groups.length} group(s)` };
}
