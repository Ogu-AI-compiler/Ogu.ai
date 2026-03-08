/**
 * Gate: spec-valid (CT001)
 * Validates that cost-tagging-spec.json exists, is valid JSON, and declares
 * all required fields. Missing fields cause downstream gates (tag validation,
 * resource coverage, enforcement mode) to fail with misleading errors.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'cost-tagging-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'CT001',
      message: 'cost-tagging-spec.json not found',
      detail: { searched: specPath, hint: 'Create cost-tagging-spec.json with organization and requiredTags fields' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'CT001', message: `cost-tagging-spec.json is not valid JSON: ${e.message}` };
  }

  const missing = ['organization', 'requiredTags'].filter(f => !spec[f]);
  if (missing.length) {
    return {
      pass: false, code: 'CT001',
      message: `cost-tagging-spec.json missing required field(s): ${missing.join(', ')}`,
      detail: { missing, hint: 'organization identifies the org unit; requiredTags is an array of tag definitions with key and description' },
    };
  }

  if (!Array.isArray(spec.requiredTags) || spec.requiredTags.length === 0) {
    return {
      pass: false, code: 'CT001',
      message: 'requiredTags must be a non-empty array',
      detail: { hint: 'Add at least one tag definition with key, description, and optional allowedValues' },
    };
  }

  return { pass: true, code: 'CT001', message: `cost-tagging-spec.json valid — ${spec.requiredTags.length} required tag(s)` };
}
