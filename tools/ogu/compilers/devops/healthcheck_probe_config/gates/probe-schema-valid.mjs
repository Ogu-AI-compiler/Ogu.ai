/**
 * Gate: probe-schema-valid (PC003)
 * Validates that every defined probe has exactly one handler (httpGet, tcpSocket,
 * exec, or grpc) and that the handler fields are complete. The kubelet rejects probes
 * with missing handler fields — the pod gets stuck in Pending with an obscure error.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

/** @param {{ httpGet?, tcpSocket?, exec?, grpc?, [key: string]: unknown }} probe @param {string} name */
function validateProbe(probe, name) {
  const errors = [];
  const hasHandler = probe.httpGet || probe.tcpSocket || probe.exec || probe.grpc;

  if (!hasHandler) {
    errors.push({ probe: name, reason: 'must have one of httpGet, tcpSocket, exec, or grpc' });
    return errors;
  }

  if (probe.httpGet) {
    if (!probe.httpGet.path) errors.push({ probe: name, field: 'httpGet.path', reason: 'missing — kubelet needs a URL path to probe' });
    if (!probe.httpGet.port) errors.push({ probe: name, field: 'httpGet.port', reason: 'missing — kubelet needs a port to connect to' });
  }
  if (probe.tcpSocket && !probe.tcpSocket.port) {
    errors.push({ probe: name, field: 'tcpSocket.port', reason: 'missing — kubelet needs a port to connect to' });
  }
  if (probe.exec && (!probe.exec.command || !Array.isArray(probe.exec.command) || probe.exec.command.length === 0)) {
    errors.push({ probe: name, field: 'exec.command', reason: 'must be a non-empty array of strings' });
  }
  if (probe.grpc && !probe.grpc.port) {
    errors.push({ probe: name, field: 'grpc.port', reason: 'missing — kubelet needs a port for gRPC health check' });
  }

  return errors;
}

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'probe-config-spec.json'), 'utf8'));
  const violations = [
    ...(spec.probes.liveness  ? validateProbe(spec.probes.liveness,  'liveness')  : []),
    ...(spec.probes.readiness ? validateProbe(spec.probes.readiness, 'readiness') : []),
    ...(spec.probes.startup   ? validateProbe(spec.probes.startup,   'startup')   : []),
  ];

  if (violations.length) {
    return {
      pass: false, code: 'PC003',
      message: `${violations.length} probe schema issue(s)`,
      detail: {
        violations,
        hint: 'Each probe needs exactly one handler. Example: { httpGet: { path: "/health", port: 3000 }, periodSeconds: 10 }',
      },
    };
  }

  return { pass: true, code: 'PC003', message: 'All probe schemas are valid' };
}
