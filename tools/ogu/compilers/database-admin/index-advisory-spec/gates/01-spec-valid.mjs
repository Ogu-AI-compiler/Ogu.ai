/**
 * Gate: spec-valid (IAS001)
 * Validates that index-advisory-spec.json exists, is valid JSON, and
 * contains valid index definitions.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REQUIRED_FIELDS = ['indexes'];

export async function run({ dir }) {
  const specPath = join(dir, 'index-advisory-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false,
      code: 'IAS001',
      message: 'index-advisory-spec.json not found',
      detail: `Expected at: ${specPath}`,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return {
      pass: false,
      code: 'IAS001',
      message: `index-advisory-spec.json is not valid JSON: ${e.message}`,
    };
  }

  const missing = REQUIRED_FIELDS.filter(f => !(f in spec));
  if (missing.length > 0) {
    return {
      pass: false,
      code: 'IAS001',
      message: `Missing required field(s): ${missing.join(', ')}`,
      detail: `Required: ${REQUIRED_FIELDS.join(', ')}`,
    };
  }

  if (!Array.isArray(spec.indexes)) {
    return {
      pass: false,
      code: 'IAS001',
      message: 'indexes must be an array',
    };
  }

  const violations = [];

  for (let i = 0; i < spec.indexes.length; i++) {
    const idx = spec.indexes[i];
    const label = `indexes[${i}]`;

    if (!idx.table) {
      violations.push(`${label}: "table" field is required`);
    }

    if (!idx.action || !['add', 'remove', 'retain'].includes(idx.action)) {
      violations.push(`${label}: "action" must be "add", "remove", or "retain"`);
    }

    if (idx.action === 'add' || idx.action === 'retain') {
      if (!Array.isArray(idx.columns) || idx.columns.length === 0) {
        violations.push(`${label}: "columns" must be a non-empty array for action "${idx.action}"`);
      }
    }

    if (idx.action === 'remove' && !idx.index_name && !Array.isArray(idx.columns)) {
      violations.push(`${label}: "remove" action requires either "index_name" or "columns"`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'IAS001',
      message: `${violations.length} index definition error(s)`,
      detail: violations.join('\n'),
    };
  }

  const addCount = spec.indexes.filter(i => i.action === 'add').length;
  const removeCount = spec.indexes.filter(i => i.action === 'remove').length;

  return {
    pass: true,
    code: 'IAS001',
    message: `Spec valid — ${spec.indexes.length} index entry/entries (add: ${addCount}, remove: ${removeCount})`,
  };
}
