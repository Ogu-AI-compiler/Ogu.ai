/**
 * Gate: contract-connection-pool (CP007)
 * Validates that connection-pool-spec.json satisfies the connection pool
 * contract: TLS must not be disabled without documented justification, and
 * a failover policy must be declared so that DB primary failover is handled
 * without manual intervention.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'connection-pool-spec.json'), 'utf8'));
  const violations = [];

  if (spec.tlsMode === 'disable' && !spec.disableTlsJustification) {
    violations.push({
      rule:   'tls-disable-requires-justification',
      reason: 'TLS is disabled without a disableTlsJustification — connections transmit credentials in plaintext',
      hint:   'Add disableTlsJustification: "..." explaining why TLS cannot be used, or change tlsMode to "require" or "verify-full"',
    });
  }
  if (!spec.failoverPolicy) {
    violations.push({
      rule:   'failoverPolicy-required',
      reason: 'No failoverPolicy declared — DB primary failover will require manual pool restart',
      hint:   'Declare failoverPolicy (e.g., "reconnect-on-error", "read-replica-fallback") to handle DB failover automatically',
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'CP007',
      message: `${violations.length} contract violation(s) in connection-pool-spec.json`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'CP007', message: `Connection pool contract satisfied — ${spec.pooler}` };
}
