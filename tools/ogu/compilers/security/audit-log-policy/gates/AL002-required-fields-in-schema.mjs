import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** AL002 — required-fields-in-schema: schema must include actor_id, timestamp, source_ip, action_result */
export async function run({ dir }) {
  const specPath = join(dir, 'audit-log-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'AL002', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'AL002', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!spec.schema) return { pass: true, code: 'AL002', message: 'No schema — gate skipped', skipped: true };

  const REQUIRED_SCHEMA_FIELDS = ['actor_id', 'timestamp', 'source_ip', 'action_result'];
  const schemaFields = typeof spec.schema === 'object' ? Object.keys(spec.schema) : [];
  const schemaFieldsLower = schemaFields.map(f => f.toLowerCase());

  const violations = [];
  for (const reqField of REQUIRED_SCHEMA_FIELDS) {
    if (!schemaFieldsLower.includes(reqField.toLowerCase())) {
      violations.push(`Schema is missing required field "${reqField}" — every audit log entry must include this field`);
    }
  }

  if (violations.length > 0) return { pass: false, code: 'AL002', message: `Schema missing ${violations.length} required field(s)`, detail: violations.join('\n') };
  return { pass: true, code: 'AL002', message: 'Schema includes all required audit fields' };
}
