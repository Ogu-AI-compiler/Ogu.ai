import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

// PII field names that must never appear in analytics payloads
const PII_FIELDS = [
  'email', 'password', 'ssn', 'social_security', 'credit_card', 'card_number',
  'cvv', 'date_of_birth', 'dob', 'phone', 'phone_number', 'address', 'street',
  'ip_address', 'full_name', 'first_name', 'last_name', 'passport', 'driver_license'
];

export async function run({ dir }) {
  // Check spec for PII in event property names
  const specPath = join(dir, 'analytics-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'AE005', message: 'analytics-spec.json not found' };

  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  const specViolations = [];
  for (const event of (spec.events || [])) {
    const props = Object.keys(event.properties || {});
    const piiProps = props.filter(p => PII_FIELDS.includes(p.toLowerCase().replace(/-/g, '_')));
    if (piiProps.length) specViolations.push(`[${event.name}] PII fields: ${piiProps.join(', ')}`);
  }

  // Check source files for PII strings passed to track()
  const files = readdirSync(dir).filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));
  const codeViolations = [];
  for (const f of files) {
    const content = readFileSync(join(dir, f), 'utf8');
    for (const pii of PII_FIELDS) {
      // Look for PII keys inside track() calls: track('EVENT', { email: ... })
      const re = new RegExp(`track\\s*\\([^)]*[{,]\\s*${pii}\\s*:`, 'i');
      if (re.test(content)) codeViolations.push(`${f}: '${pii}' passed to track()`);
    }
  }

  const all = [...specViolations, ...codeViolations];
  if (all.length) {
    return { pass: false, code: 'AE005', message: `PII detected in analytics payload`, detail: all.join('\n') };
  }

  return { pass: true, code: 'AE005', message: 'No PII fields detected in analytics events' };
}
