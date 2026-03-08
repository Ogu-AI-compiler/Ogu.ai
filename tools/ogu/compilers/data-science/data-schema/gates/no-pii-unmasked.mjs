/**
 * Why:
 * PII columns must be annotated with `pii: true` and a `masking` strategy.
 * Storing or transmitting raw PII without annotation is a compliance risk
 * (GDPR Art. 25, CCPA, HIPAA). Without explicit annotation:
 *   - Engineers don't know which columns require special access controls
 *   - EDA notebooks might log PII to stdout or commit it to git
 *   - Model features may inadvertently include identifying information
 *
 * Detection: heuristic on column names. If a column is named "email",
 * "ssn", "phone", etc., it is treated as PII unless annotated.
 *
 * Escape hatch: set `"pii_reviewed": true` on a column to indicate the
 * PII status has been consciously reviewed and confirmed non-PII despite
 * the name match (e.g., a column called "phone_count" is not PII).
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const PII_PATTERNS = [
  { re: /\bemail\b/i,                              label: 'email' },
  { re: /\bssn\b|\bsocial.?security\b/i,           label: 'SSN' },
  { re: /\bphone\b|\bmobile\b|\bcell_?num/i,        label: 'phone' },
  { re: /\bdob\b|\bdate.?of.?birth\b|\bbirthdate\b/i, label: 'date of birth' },
  { re: /\bpassport\b|\bnational.?id\b/i,           label: 'passport/national ID' },
  { re: /\bcredit.?card\b|\bcard.?number\b|\bpan\b/i, label: 'credit card' },
  { re: /\bfull.?name\b|\bfirst.?name\b|\blast.?name\b|\bsurname\b/i, label: 'full name' },
  { re: /\bip.?addr/i,                              label: 'IP address' },
  { re: /\bgeo.?loc|\blat.?lon\b|\blatitude\b/i,    label: 'geolocation' },
];

function matchesPII(name) {
  return PII_PATTERNS.find(p => p.re.test(name));
}

export async function run({ dir }) {
  const specPath = join(dir, 'data-schema-spec.json');

  if (existsSync(specPath)) {
    let spec;
    try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
    catch { return { pass: true, code: 'DS007', message: 'Cannot read spec — skipped', skipped: true }; }

    const cols = spec.columns || [];
    const violations = [];

    for (const col of cols) {
      const piiMatch = matchesPII(col.name);
      if (!piiMatch) continue;
      if (col.pii_reviewed) continue;  // escape hatch: consciously reviewed
      if (!col.pii || !col.masking) {
        violations.push(`"${col.name}" (${piiMatch.label}) — missing pii:true and/or masking strategy`);
      }
    }

    if (violations.length) {
      return {
        pass: false, code: 'DS007',
        message: `${violations.length} PII column(s) without masking annotation`,
        detail: violations.join('\n') + '\n\n' +
                'Add to each PII column:\n' +
                '  { "pii": true, "masking": "hash_sha256" | "redact" | "pseudonymize" | "tokenize" }\n' +
                'If the name match is a false positive, add "pii_reviewed": true.',
      };
    }

    const piiCols = cols.filter(c => matchesPII(c.name) && !c.pii_reviewed);
    return {
      pass: true, code: 'DS007',
      message: piiCols.length
        ? `All ${piiCols.length} PII column(s) annotated with masking strategy`
        : 'No PII column names detected',
    };
  }

  // Fallback: scan Python files
  const pyFiles = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!pyFiles.length) return { pass: true, code: 'DS007', message: 'No spec or Python files — skipped', skipped: true };

  const content = pyFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n').toLowerCase();
  const found = PII_PATTERNS.filter(p => p.re.test(content));
  if (found.length) {
    return {
      pass: false, code: 'DS007',
      message: `PII column names detected without annotation: ${found.map(p => p.label).join(', ')}`,
      detail: 'Define a data-schema-spec.json and annotate PII columns with pii:true + masking.',
    };
  }
  return { pass: true, code: 'DS007', message: 'No PII column names detected in Python files' };
}
