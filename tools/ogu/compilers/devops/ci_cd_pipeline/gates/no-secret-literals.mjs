/**
 * Gate: no-secret-literals (CIP005)
 * Scans the ci-cd-spec.json for hardcoded secret values. Pipeline definitions that
 * contain literal credentials get committed to source control and are exposed in
 * build logs. All secrets must use platform secret contexts (${{ secrets.X }}, $VAR).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

/** Patterns that indicate a secret value being hard-coded (not a variable reference) */
const SECRET_KEY_RE = /(?:password|passwd|secret|token|api_key|apikey|private_key|credentials|auth_token)/i;
const LITERAL_VALUE_RE = /[:=]\s*["']?[A-Za-z0-9+/]{16,}["']?/;

/** Patterns that are safe — they reference platform secret stores, not literals */
const SAFE_PATTERNS = [
  /\$\{\{\s*secrets\./,   // GitHub Actions: ${{ secrets.X }}
  /\$\{[A-Z_]+\}/,        // Shell variable: ${MY_VAR}
  /\$[A-Z_]{3,}/,         // Shell variable: $MY_VAR
  /\$CI_/,                // GitLab CI: $CI_REGISTRY_PASSWORD
  /vault:kv/,             // Vault path reference
];

function isSafe(line) {
  return SAFE_PATTERNS.some(p => p.test(line));
}

export async function run({ dir }) {
  const content    = readFileSync(join(dir, 'ci-cd-spec.json'), 'utf8');
  const lines      = content.split('\n');
  const violations = [];

  lines.forEach((line, i) => {
    if (isSafe(line)) return;
    if (SECRET_KEY_RE.test(line) && LITERAL_VALUE_RE.test(line)) {
      violations.push({ line: i + 1, content: line.trim() });
    }
  });

  if (violations.length) {
    return {
      pass: false, code: 'CIP005',
      message: `${violations.length} potential hardcoded secret(s) found`,
      detail: {
        violations,
        hint: 'Replace literal values with platform secret references: ${{ secrets.MY_SECRET }} (GitHub), $MY_SECRET (GitLab/Jenkins)',
      },
    };
  }

  return { pass: true, code: 'CIP005', message: 'No hardcoded secret literals found in pipeline spec' };
}
