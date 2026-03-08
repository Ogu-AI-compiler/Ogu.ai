import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** AL003 — no-pii-in-logs: fields marked as PII or secret must not be logged in plaintext */
export async function run({ dir }) {
  const specPath = join(dir, 'audit-log-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'AL003', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'AL003', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!spec.schema) return { pass: true, code: 'AL003', message: 'No schema — gate skipped', skipped: true };

  const PII_FIELD_NAMES = ['email', 'phone', 'ssn', 'password', 'credit_card', 'card_number', 'dob', 'date_of_birth', 'address', 'ip_address', 'national_id'];
  const violations = [];
  const schemaEntries = typeof spec.schema === 'object' ? Object.entries(spec.schema) : [];

  for (const [fieldName, fieldDef] of schemaEntries) {
    const fieldNameLower = fieldName.toLowerCase();
    const def = typeof fieldDef === 'object' ? fieldDef : {};
    const isPii = def.is_pii === true || PII_FIELD_NAMES.some(pii => fieldNameLower.includes(pii));
    const isSecret = def.is_secret === true;

    if ((isPii || isSecret) && def.mask !== true && def.log_handling !== 'mask' && def.log_handling !== 'exclude' && def.log_handling !== 'hash') {
      violations.push(`Schema field "${fieldName}" is PII/secret but has no masking policy — set mask: true or log_handling: "mask" | "exclude" | "hash"`);
    }
  }

  // Also check if any event-level logged_fields includes known PII names without masking
  if (Array.isArray(spec.events)) {
    for (const event of spec.events) {
      if (!Array.isArray(event.logged_fields)) continue;
      for (const lf of event.logged_fields) {
        const lfName = String(lf.name || lf || '').toLowerCase();
        const lfDef = typeof lf === 'object' ? lf : {};
        const isPii = PII_FIELD_NAMES.some(pii => lfName.includes(pii));
        if (isPii && lfDef.mask !== true && lfDef.log_handling !== 'mask' && lfDef.log_handling !== 'exclude') {
          violations.push(`Event "${event.action}" logged_field "${lfName}" looks like PII — declare mask: true or log_handling: "mask"`);
        }
      }
    }
  }

  if (violations.length > 0) return { pass: false, code: 'AL003', message: `${violations.length} PII/secret field(s) logged without masking`, detail: violations.join('\n') };
  return { pass: true, code: 'AL003', message: 'No PII or secret fields logged in plaintext' };
}
