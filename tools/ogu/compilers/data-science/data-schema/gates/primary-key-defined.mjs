import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * DS004 — primary-key-defined
 * Data schemas must declare a primary key or unique row identifier.
 *
 * Why:
 * - Without a primary key, there's no canonical way to identify records,
 *   detect duplicates, or perform idempotent upserts.
 * - ML training data without a primary key cannot be:
 *   - Incrementally updated (which records are new?)
 *   - Deduplicated deterministically (which of two duplicates to keep?)
 *   - Joined to additional feature tables without risking row explosion
 *   - Tracked in lineage systems (which model saw which rows?)
 * - The primary key doesn't need to be a database-style monotonic ID.
 *   A composite key (user_id + event_date), a hash key, or a UUID all work.
 *   The key requirement: no two rows should share the same key value.
 *
 * Escape hatch: set "noPrimaryKey": true to data-schema-spec.json for
 * anonymized datasets where keys have been intentionally stripped (e.g.,
 * for privacy compliance) or for pure aggregation tables (no row-level ID).
 */

export async function run({ dir }) {
  const specPath = join(dir, 'data-schema-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'DS004', message: 'No spec — primary key check skipped', skipped: true };
  }

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'DS004', message: 'data-schema-spec.json not parseable' }; }

  if (spec.noPrimaryKey === true) {
    return { pass: true, code: 'DS004', message: 'noPrimaryKey: true — primary key intentionally absent', skipped: true };
  }

  // Check spec-level primary key declaration
  const specPK = spec.primary_key;
  const colPK  = (spec.columns ?? []).find(c => c.primary_key === true || c.unique === true || c.is_index === true);

  if (!specPK && !colPK) {
    return {
      pass: false, code: 'DS004',
      message: 'No primary key or unique identifier defined in schema',
      detail: 'Declare a primary key in data-schema-spec.json:\n\n' +
        'Option 1 — spec-level:\n' +
        '  "primary_key": "user_id"\n' +
        '  OR "primary_key": ["user_id", "event_date"]  (composite)\n\n' +
        'Option 2 — column-level:\n' +
        '  { "name": "user_id", "dtype": "int64", "primary_key": true }\n\n' +
        'Option 3 — anonymized data:\n' +
        '  "noPrimaryKey": true',
    };
  }

  // Verify the declared PK column actually exists in columns
  if (specPK && spec.columns) {
    const pkNames = Array.isArray(specPK) ? specPK : [specPK];
    const missingCols = pkNames.filter(pk => !spec.columns.some(c => c.name === pk));
    if (missingCols.length) {
      return {
        pass: false, code: 'DS004',
        message: `Primary key column(s) not found in schema: ${missingCols.join(', ')}`,
        detail: `Declared primary_key: ${JSON.stringify(specPK)}\nMissing from columns[]: ${missingCols.join(', ')}`,
      };
    }
  }

  const pk = specPK ?? colPK?.name;
  const pkDisplay = Array.isArray(pk) ? pk.join(', ') : pk;

  return {
    pass: true, code: 'DS004',
    message: `Primary key defined: ${pkDisplay}`,
  };
}
