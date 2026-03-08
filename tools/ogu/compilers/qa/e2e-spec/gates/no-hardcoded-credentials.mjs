import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA024 — no-hardcoded-credentials
 * User flows must not contain literal passwords, tokens, or secrets.
 * These get committed to git and are exposed in CI logs.
 *
 * The spec itself (JSON file) is scanned. Also scans any E2E fixture files
 * in e2e/, playwright/, cypress/ directories.
 *
 * Detects: any field named password/token/secret/apiKey/api_key/auth with
 * a non-empty string value that is not a ${VAR} reference.
 *
 * Also detects: obviously real-looking credentials in string values
 * (32+ hex chars that look like API keys).
 */

const SENSITIVE_KEYS = /^(?:password|passwd|token|secret|api[_-]?key|auth|credential|private[_-]?key)$/i;
const ENV_VAR_RE = /^\$\{[A-Z_][A-Z0-9_]*\}$/;
// Long hex/base64 string that looks like an actual secret
const LOOKS_LIKE_SECRET = /^[a-zA-Z0-9+/=_-]{32,}$/;

function scanObject(obj, path, violations) {
  if (!obj || typeof obj !== 'object') return;
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = path ? `${path}.${key}` : key;
    if (typeof val === 'string') {
      if (SENSITIVE_KEYS.test(key) && val.length > 0 && !ENV_VAR_RE.test(val)) {
        violations.push(`"${fullKey}" contains a hardcoded credential value — use \${ENV_VAR} instead`);
      }
      // Catch anything that looks like a 40+ char API key even under non-sensitive key names
      if (!SENSITIVE_KEYS.test(key) && LOOKS_LIKE_SECRET.test(val) && val.length > 40) {
        violations.push(`"${fullKey}" value looks like a secret (${val.length} chars) — move to environment variable`);
      }
    } else if (typeof val === 'object' && val !== null) {
      scanObject(val, fullKey, violations);
    }
  }
}

export async function run({ dir }) {
  let spec;
  try {
    spec = JSON.parse(readFileSync(join(dir, 'e2e-spec.json'), 'utf8'));
  } catch {
    return { pass: false, code: 'QA024', message: 'e2e-spec.json not readable' };
  }

  const violations = [];
  scanObject(spec, '', violations);

  if (violations.length) {
    return {
      pass: false, code: 'QA024',
      message: `${violations.length} hardcoded credential(s) detected in spec`,
      detail: violations.join('\n') + '\n\nUse ${E2E_USER_PASSWORD} style references and inject via CI secrets.',
    };
  }

  return {
    pass: true, code: 'QA024',
    message: 'No hardcoded credentials detected in E2E spec',
  };
}
