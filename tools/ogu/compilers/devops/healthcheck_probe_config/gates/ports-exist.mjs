/**
 * Gate: ports-exist (PC002)
 * Validates that every port referenced in probe handlers (httpGet.port, tcpSocket.port)
 * is declared in containerPorts. A probe targeting an undeclared port will cause the
 * kubelet to report a probe failure, putting the pod into a CrashLoopBackOff.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec             = JSON.parse(readFileSync(join(dir, 'probe-config-spec.json'), 'utf8'));
  const containerPortNums  = new Set(spec.containerPorts.map(p => p.port));
  const containerPortNames = new Set(spec.containerPorts.map(p => p.name).filter(Boolean));
  const violations         = [];

  function checkProbePort(probe, probeName) {
    if (!probe) return;
    const port = probe.httpGet?.port ?? probe.tcpSocket?.port;
    if (port === undefined) return;
    if (typeof port === 'number' && !containerPortNums.has(port)) {
      violations.push({ probe: probeName, port, reason: `port ${port} is not declared in containerPorts` });
    }
    if (typeof port === 'string' && !containerPortNames.has(port)) {
      violations.push({ probe: probeName, port, reason: `named port "${port}" is not declared in containerPorts` });
    }
  }

  checkProbePort(spec.probes.liveness,  'liveness');
  checkProbePort(spec.probes.readiness, 'readiness');
  checkProbePort(spec.probes.startup,   'startup');

  if (violations.length) {
    return {
      pass: false, code: 'PC002',
      message: `${violations.length} probe port reference issue(s)`,
      detail: {
        violations,
        declaredPorts: spec.containerPorts,
        hint: 'Use a port number or name that is declared in containerPorts',
      },
    };
  }

  return { pass: true, code: 'PC002', message: 'All probe ports exist on the container' };
}
