import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA023 — baseurl-from-env
 * baseUrl must not be a hardcoded localhost URL or IP address.
 * It must reference an environment variable using ${VAR_NAME} syntax.
 *
 * Hardcoded localhost means the E2E tests only run on the developer's machine.
 * In CI, staging, or preview environments the URL is different — hardcoded
 * URLs cause tests to either fail or silently test the wrong environment.
 *
 * Valid: "${E2E_BASE_URL}", "${BASE_URL}", "${TEST_BASE_URL}"
 * Invalid: "http://localhost:3000", "http://127.0.0.1:3000", "https://app.example.com"
 */

const HARDCODED_URL_RE = /^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i;
const ENV_VAR_RE = /\$\{[A-Z_][A-Z0-9_]*\}/;

export async function run({ dir }) {
  let spec;
  try {
    spec = JSON.parse(readFileSync(join(dir, 'e2e-spec.json'), 'utf8'));
  } catch {
    return { pass: false, code: 'QA023', message: 'e2e-spec.json not readable' };
  }

  const baseUrl = spec.baseUrl || '';

  if (HARDCODED_URL_RE.test(baseUrl)) {
    return {
      pass: false, code: 'QA023',
      message: `baseUrl "${baseUrl}" is hardcoded to localhost — tests will only run on developer machine`,
      detail: `Use an environment variable instead:\n  "baseUrl": "\${E2E_BASE_URL}"\n\nSet E2E_BASE_URL=http://localhost:3000 locally and to the staging URL in CI.`,
    };
  }

  if (!ENV_VAR_RE.test(baseUrl)) {
    return {
      pass: false, code: 'QA023',
      message: `baseUrl "${baseUrl}" does not use environment variable interpolation`,
      detail: `baseUrl must contain \${VAR_NAME} syntax, e.g. "\${E2E_BASE_URL}". A hardcoded domain also fails because preview/staging URLs differ from production.`,
    };
  }

  return {
    pass: true, code: 'QA023',
    message: `baseUrl uses environment variable: "${baseUrl}"`,
  };
}
