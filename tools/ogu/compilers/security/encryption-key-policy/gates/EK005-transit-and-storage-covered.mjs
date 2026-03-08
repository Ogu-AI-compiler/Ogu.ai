import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** EK005 — transit-and-storage-covered: policy must cover both data-in-transit and data-at-rest */
export async function run({ dir }) {
  const specPath = join(dir, 'encryption-key-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'EK005', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'EK005', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.keys) || spec.keys.length === 0) {
    return { pass: true, code: 'EK005', message: 'No keys — gate skipped', skipped: true };
  }

  const TRANSIT_TERMS = ['transit', 'tls', 'transport', 'in-flight', 'channel'];
  const STORAGE_TERMS = ['at-rest', 'storage', 'disk', 'database', 'field-level', 'envelope'];

  let hasTransitKey = false;
  let hasStorageKey = false;

  for (const key of spec.keys) {
    const purposeLower = String(key.purpose || '').toLowerCase();
    const coverageLower = String(key.coverage || '').toLowerCase();
    const combined = purposeLower + ' ' + coverageLower;

    if (TRANSIT_TERMS.some(t => combined.includes(t))) hasTransitKey = true;
    if (STORAGE_TERMS.some(t => combined.includes(t))) hasStorageKey = true;
  }

  // If the policy declares tls_managed_externally: true, skip the transit check
  const tlsManagedExternally = spec.tls_managed_externally === true;

  const violations = [];

  if (!hasTransitKey && !tlsManagedExternally) {
    violations.push('No key declared for data-in-transit encryption — add a key with purpose containing "transit" or "tls", or set tls_managed_externally: true if TLS is handled at the infrastructure layer');
  }
  if (!hasStorageKey) {
    violations.push('No key declared for data-at-rest encryption — add a key with purpose containing "at-rest", "storage", or "database"');
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'EK005',
      message: `Encryption policy does not cover all required data states`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'EK005', message: 'Encryption policy covers both data-in-transit and data-at-rest' };
}
