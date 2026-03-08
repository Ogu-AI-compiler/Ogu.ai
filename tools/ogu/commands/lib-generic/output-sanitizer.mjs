/**
 * Output Sanitizer — clean sensitive data from outputs.
 */

const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9]{8,}/g,                // API keys
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g,    // Bearer tokens
  /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_.+/=]*/g, // JWTs
  /ghp_[a-zA-Z0-9]{36}/g,               // GitHub tokens
  /xoxb-[0-9]{10,}-[a-zA-Z0-9]{20,}/g,  // Slack tokens
];

const SENSITIVE_KEYS = ['password', 'secret', 'token', 'apiKey', 'api_key', 'authorization', 'credential'];

/**
 * Sanitize a string output by redacting sensitive patterns.
 *
 * @param {string} output
 * @returns {string}
 */
export function sanitize(output) {
  let result = output;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

/**
 * Sanitize an object by redacting values of sensitive keys.
 *
 * @param {object} obj
 * @returns {object}
 */
export function sanitizeObject(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = value;
    }
  }
  return result;
}
