/**
 * Gate: format-consistent (CSC007)
 * All connection string entries must use the same format — either all URI
 * (postgres://...) or all DSN (host=... port=... dbname=... user=... password=...).
 * Mixed formats cause inconsistent parsing across services and environments.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const URI_PREFIX_RE = /^postgres(?:ql)?:\/\//i;
const DSN_FIELD_RE = /\b(?:host|dbname|user|password|port)\s*=/i;

function detectFormat(connStr) {
  if (!connStr || typeof connStr !== 'string') return null;
  if (URI_PREFIX_RE.test(connStr)) return 'uri';
  if (DSN_FIELD_RE.test(connStr)) return 'dsn';
  return null;
}

export async function run({ dir }) {
  const specPath = join(dir, 'connection-string-contract.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'CSC007', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'CSC007', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  // If connection strings are not used (just host/port fields), skip
  const declaredFormat = spec.format;

  if (!Array.isArray(spec.services) || spec.services.length === 0) {
    return { pass: true, code: 'CSC007', message: 'No services declared — gate skipped', skipped: true };
  }

  const violations = [];
  const detectedFormats = [];

  for (const service of spec.services) {
    const serviceName = service.name || '(unnamed)';
    const envEntries = Array.isArray(service.environments) ? service.environments : [];

    for (const envEntry of envEntries) {
      if (!envEntry.connection_string) continue;

      const fmt = detectFormat(envEntry.connection_string);
      const label = `service "${serviceName}" / env "${envEntry.env || '?'}"`;

      if (fmt && fmt !== declaredFormat) {
        violations.push(`${label}: connection_string appears to be "${fmt}" but spec declares format: "${declaredFormat}"`);
      }

      if (fmt) {
        detectedFormats.push(fmt);
      }
    }
  }

  // Check for mixed formats within the entries themselves
  const uniqueFormats = [...new Set(detectedFormats)];
  if (uniqueFormats.length > 1) {
    violations.push(`Mixed connection string formats detected: ${uniqueFormats.join(', ')}. All entries must use the same format.`);
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'CSC007',
      message: `${violations.length} format consistency violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'CSC007',
    message: `All connection strings use consistent format: "${declaredFormat}"`,
  };
}
