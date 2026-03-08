/**
 * Gate: contract-k8s-workload (KW008)
 * Enforces the kubernetes_workload runtime contract: probes must be defined so the
 * orchestrator can detect unhealthy pods, single-replica Deployments without an HPA
 * cannot perform zero-downtime rolling updates, and the namespace must be declared
 * (workloads in the default namespace are an operational antipattern in shared clusters).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'k8s-workload-spec.json'), 'utf8'));
  const violations = [];

  if (!spec.skipProbeCheck) {
    if (!spec.livenessProbe && !spec.probes?.liveness) {
      violations.push({
        rule:   'liveness-probe-required',
        reason: 'No livenessProbe defined — the orchestrator cannot detect stuck or deadlocked containers',
        hint:   'Add livenessProbe: { httpGet: { path: /health, port: 3000 }, initialDelaySeconds: 10 }',
      });
    }
    if (!spec.readinessProbe && !spec.probes?.readiness) {
      violations.push({
        rule:   'readiness-probe-required',
        reason: 'No readinessProbe defined — traffic will be routed to unready containers during startup/restart',
        hint:   'Add readinessProbe: { httpGet: { path: /ready, port: 3000 }, initialDelaySeconds: 5 }',
      });
    }
  }

  if (spec.kind === 'Deployment' && spec.replicas === 1 && !spec.hpa && !spec.skipSingleReplicaCheck) {
    violations.push({
      rule:   'single-replica-risk',
      reason: 'Single replica Deployment with no HPA — a rolling update will cause a brief downtime window',
      hint:   'Set replicas: 2 for zero-downtime rolling updates, or add an HPA with minReplicas: 2',
    });
  }

  if (!spec.namespace) {
    violations.push({
      rule:   'namespace-required',
      reason: 'No namespace declared — the workload will be deployed to the "default" namespace',
      hint:   'Add namespace: "my-service" to isolate the workload and apply namespace-scoped RBAC',
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'KW008',
      message: `${violations.length} contract violation(s)`,
      detail: { violations },
    };
  }

  return {
    pass: true, code: 'KW008',
    message: `K8s workload contract satisfied — ${spec.kind} "${spec.name}" in namespace "${spec.namespace}"`,
  };
}
