/**
 * Why:
 * Nullable columns must document WHY they can be null and how nulls are handled
 * downstream. Silent nullability is a data quality debt: NaN values propagate
 * through pipelines, corrupt aggregations, and cause silent model degradation.
 *
 * Required: a `null_strategy` field explaining the null handling policy.
 * Examples: "expected for non-purchase events", "imputed with median", "excluded from training"
 *
 * Escape hatch: set `"null_documented": true` if null_strategy is tracked
 * externally (e.g., in a separate data dictionary).
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'data-schema-spec.json');
  if (!existsSync(specPath)) return { pass: true, code: 'DS003', message: 'No spec — skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'DS003', message: 'data-schema-spec.json is invalid JSON' }; }

  const nullable = (spec.columns || []).filter(c => c.nullable === true);
  const undocumented = nullable.filter(c => !c.null_strategy && !c.null_documented);

  if (undocumented.length) {
    return {
      pass: false, code: 'DS003',
      message: `${undocumented.length} nullable column(s) without null_strategy: ${undocumented.map(c => c.name).join(', ')}`,
      detail: 'Document how nulls are handled:\n' +
              '  { "name": "amount", "nullable": true, "null_strategy": "expected for non-purchase events" }\n' +
              'Or set "null_documented": true if tracked in a data dictionary.',
    };
  }

  const summary = nullable.length
    ? `${nullable.length} nullable column(s) all have null_strategy`
    : 'No nullable columns declared';
  return { pass: true, code: 'DS003', message: summary };
}
