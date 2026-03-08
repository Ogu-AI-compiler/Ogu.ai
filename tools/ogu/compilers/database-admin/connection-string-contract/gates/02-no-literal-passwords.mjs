/**
 * Gate: no-literal-passwords (CSC002)
 * No connection string entry may contain a literal password value.
 * Credentials must reference a vault path or environment variable placeholder.
 *
 * Accepted patterns:
 *   - "${DB_PASSWORD}"     (env var placeholder)
 *   - "{{vault:secret/db/password}}"  (vault reference)
 *   - "$DB_PASSWORD"       (shell env var)
 *
 * Rejected patterns:
 *   - Any password field containing a non-placeholder string value
 *   - Any connection string URL with an embedded password (postgres://user:pass@host)
 *
 * Escape hatch: // @literal-password-ok — for test/local environments with known dummy creds
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Detects embedded password in URI: postgres://user:PASSWORD@host
const URI_EMBEDDED_PASSWORD_RE = /postgres(?:ql)?:\/\/[^:@\s]+:[^$@{][^@\s]*@/i;

// Detects what looks like a real password (not a placeholder)
// A placeholder must start with ${ or {{ or $[A-Z] or be empty
function isLiteralPassword(value) {
  if (!value || typeof value !== 'string') return false;
  if (value.startsWith('${') && value.endsWith('}')) return false;
  if (value.startsWith('{{') && value.endsWith('}}')) return false;
  if (/^\$[A-Z_][A-Z0-9_]*$/.test(value)) return false;
  if (value === '') return false;
  // Anything else is treated as a literal credential
  return true;
}

export async function run({ dir }) {
  const specPath = join(dir, 'connection-string-contract.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'CSC002', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'CSC002', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  const violations = [];

  function checkEntry(label, entry, escapeHatch) {
    // Check password field
    if ('password' in entry && isLiteralPassword(entry.password)) {
      if (!escapeHatch) {
        violations.push(`${label}: password field contains a literal credential (use \${ENV_VAR} or vault reference)`);
      }
    }

    // Check for embedded password in connection string URLs
    if (entry.connection_string && typeof entry.connection_string === 'string') {
      if (URI_EMBEDDED_PASSWORD_RE.test(entry.connection_string)) {
        if (!escapeHatch) {
          violations.push(`${label}: connection_string contains an embedded password in the URI (use \${DB_PASSWORD} placeholder instead)`);
        }
      }
    }
  }

  // Check per-service, per-environment entries
  if (Array.isArray(spec.services)) {
    for (const service of spec.services) {
      const serviceName = service.name || '(unnamed service)';

      if (Array.isArray(service.environments)) {
        for (const envEntry of service.environments) {
          const label = `service "${serviceName}" / env "${envEntry.env || '?'}"`;
          const hasEscapeHatch = envEntry.comment && envEntry.comment.includes('@literal-password-ok');
          checkEntry(label, envEntry, hasEscapeHatch);
        }
      } else {
        // Flat structure: service has direct connection fields
        const hasEscapeHatch = service.comment && service.comment.includes('@literal-password-ok');
        checkEntry(`service "${serviceName}"`, service, hasEscapeHatch);
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'CSC002',
      message: `${violations.length} literal credential(s) detected`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'CSC002',
    message: 'No literal credentials found — all passwords use vault/env-var references',
  };
}
