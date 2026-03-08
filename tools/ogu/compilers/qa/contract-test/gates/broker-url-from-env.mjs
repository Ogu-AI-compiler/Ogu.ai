import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA051 — broker-url-from-env
 * The Pact broker URL must come from an environment variable, not be hardcoded.
 *
 * A hardcoded broker URL means:
 *   - The URL is committed to source control (potentially a private service URL)
 *   - Different environments (staging, prod) cannot use different brokers
 *   - Rotating the broker URL requires a code change + deploy cycle
 *
 * Pattern: brokerUrl must match `${ENV_VAR}` or `$ENV_VAR` syntax.
 * Also checks: brokerToken, brokerUsername, brokerPassword must not be literals.
 *
 * If spec.broker is not declared, this gate is skipped (some frameworks don't use a broker).
 */

const ENV_VAR_RE = /^\$\{[A-Z_][A-Z0-9_]*\}$|^\$[A-Z_][A-Z0-9_]*$/;
const CREDENTIAL_KEYS = ['brokerToken', 'brokerUsername', 'brokerPassword', 'token', 'apiKey'];

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'contract-test-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA051', message: 'contract-test-spec.json not readable' }; }

  const broker = spec.broker;
  if (!broker) {
    return { pass: true, code: 'QA051', message: 'No broker declared — skipped', skipped: true };
  }

  const url = broker.url ?? broker.brokerUrl ?? spec.brokerUrl;
  if (!url) {
    return {
      pass: false, code: 'QA051',
      message: 'broker is declared but broker.url is missing',
      detail: 'Add "url": "${PACT_BROKER_URL}" to the broker object',
    };
  }

  // Check for hardcoded URL (http/https literal)
  if (/^https?:\/\//i.test(url)) {
    return {
      pass: false, code: 'QA051',
      message: `broker.url "${url}" is hardcoded — must use environment variable`,
      detail: 'Use: "url": "${PACT_BROKER_URL}"\nThis prevents committing internal service URLs and supports multi-environment brokers.',
    };
  }

  if (!ENV_VAR_RE.test(url)) {
    return {
      pass: false, code: 'QA051',
      message: `broker.url "${url}" does not match env-var pattern (\${VAR} or $VAR)`,
    };
  }

  // Check credentials are not hardcoded
  const violations = [];
  for (const key of CREDENTIAL_KEYS) {
    const val = broker[key];
    if (typeof val === 'string' && !ENV_VAR_RE.test(val) && val.length > 0) {
      violations.push(`broker.${key} appears to be a literal value — use \${ENV_VAR} instead`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'QA051',
      message: `${violations.length} hardcoded credential(s) in broker config`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'QA051', message: `broker.url uses env-var: ${url}` };
}
