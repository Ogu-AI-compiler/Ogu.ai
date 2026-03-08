/**
 * Gate: ports-valid (KS003)
 * Validates that every port entry in the Service spec has a valid port number, a
 * targetPort, and if a protocol is specified, it is a protocol supported by Kubernetes.
 * Invalid port configurations cause the Service to be rejected by the API server.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const VALID_PROTOCOLS = ['TCP', 'UDP', 'SCTP'];

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'k8s-service-spec.json'), 'utf8'));
  const violations = [];

  for (const p of spec.ports) {
    if (!p.port) {
      violations.push({ entry: JSON.stringify(p), reason: 'missing port number' });
      continue;
    }
    if (p.port < 1 || p.port > 65535) {
      violations.push({ port: p.port, reason: 'port out of valid range (1–65535)' });
    }
    if (!p.targetPort && !p.name) {
      violations.push({ port: p.port, reason: 'missing targetPort (and no port name as fallback)' });
    }
    if (typeof p.targetPort === 'number' && (p.targetPort < 1 || p.targetPort > 65535)) {
      violations.push({ port: p.port, targetPort: p.targetPort, reason: 'targetPort out of valid range (1–65535)' });
    }
    if (p.protocol && !VALID_PROTOCOLS.includes(p.protocol)) {
      violations.push({ port: p.port, protocol: p.protocol, reason: `invalid protocol — must be one of: ${VALID_PROTOCOLS.join(', ')}` });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'KS003',
      message: `${violations.length} port issue(s)`,
      detail: {
        violations,
        hint: 'Valid port entry: { port: 80, targetPort: 3000, protocol: "TCP" }',
      },
    };
  }

  return { pass: true, code: 'KS003', message: `All ${spec.ports.length} ports are valid` };
}
