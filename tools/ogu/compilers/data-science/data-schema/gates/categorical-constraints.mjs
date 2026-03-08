import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * DS006 — categorical-constraints
 * Categorical columns must declare allowed values (closed-set) or be
 * explicitly marked as open-ended with documented examples.
 *
 * Why:
 * - Categorical features without constraints silently accept new categories
 *   at serving time. A "country" column that trained on ["US", "UK", "DE"]
 *   will receive "BR" at serving time — producing either an error or an
 *   encoding of an unseen category (often index 0, meaning "US" in disguise).
 * - Training on unexpected categories inflates model complexity without
 *   improving performance. A model that "learned" the "Unknown" category
 *   because a pipeline bug introduced it will generalize poorly.
 * - Declared allowed_values enable:
 *   - Automatic validation at data load time (pandera/great_expectations)
 *   - OrdinalEncoder with explicit handle_unknown='use_encoded_value'
 *   - Category drift detection (new category appeared in production data)
 *
 * Schema convention:
 *   { "name": "status", "dtype": "category", "allowed_values": ["active", "inactive", "pending"] }
 *   { "name": "notes",  "dtype": "category", "open_ended": true, "examples": ["Free text note"] }
 *
 * Escape hatch: set open_ended: true for columns where the value space
 * cannot be pre-specified (user-generated text, new market codes).
 */

export async function run({ dir }) {
  const specPath = join(dir, 'data-schema-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'DS006', message: 'No spec — categorical check skipped', skipped: true };
  }

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'DS006', message: 'data-schema-spec.json not parseable' }; }

  const catCols = (spec.columns ?? []).filter(c =>
    c.dtype === 'category' || c.dtype === 'bool' || c.dtype === 'string' && c.categorical
  );

  if (!catCols.length) {
    return { pass: true, code: 'DS006', message: 'No categorical columns declared — check skipped', skipped: true };
  }

  const unconstrained = catCols.filter(c => !c.allowed_values && !c.open_ended);
  const openEndedNoExamples = catCols.filter(c => c.open_ended && !c.examples);

  const issues = [];

  for (const col of unconstrained) {
    issues.push(`Column "${col.name}" (${col.dtype}): missing allowed_values[] or open_ended: true`);
  }

  for (const col of openEndedNoExamples) {
    issues.push(`Column "${col.name}": open_ended but no examples[] — add 2-3 representative examples`);
  }

  if (issues.length) {
    return {
      pass: false, code: 'DS006',
      message: `${issues.length} categorical column(s) lack constraints`,
      detail: issues.join('\n') +
        '\n\nFix examples:\n' +
        '  { "name": "status", "dtype": "category",\n' +
        '    "allowed_values": ["active", "inactive", "pending"] }\n' +
        '  { "name": "notes", "dtype": "category", "open_ended": true,\n' +
        '    "examples": ["Contacted via phone", "Email follow-up needed"] }',
    };
  }

  return {
    pass: true, code: 'DS006',
    message: `All ${catCols.length} categorical column(s) have constraints`,
  };
}
