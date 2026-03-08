/**
 * Gate: contract-k8s-service (KS007)
 * Enforces the kubernetes_service runtime contract: the Service must declare a
 * namespace (services in default are an antipattern in shared clusters), and
 * LoadBalancer services must include cloud-specific annotations (without them,
 * the cloud controller creates a public internet-facing load balancer by default).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'k8s-service-spec.json'), 'utf8'));
  const violations = [];

  if (!spec.namespace) {
    violations.push({
      rule:   'namespace-required',
      reason: 'No namespace declared — Service will be deployed to the "default" namespace',
      hint:   'Add namespace: "my-service" to isolate the Service and apply namespace-scoped RBAC',
    });
  }

  if (spec.type === 'LoadBalancer' && !spec.annotations) {
    violations.push({
      rule:   'loadbalancer-annotations-required',
      reason: 'LoadBalancer Service has no annotations — the cloud controller creates a public internet-facing LB by default',
      hint:   'Add cloud-specific annotations. For internal AWS NLB: annotations: { "service.beta.kubernetes.io/aws-load-balancer-internal": "true" }',
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'KS007',
      message: `${violations.length} contract violation(s)`,
      detail: { violations },
    };
  }

  return {
    pass: true, code: 'KS007',
    message: `K8s Service contract satisfied — "${spec.name}" (${spec.type || 'ClusterIP'})`,
  };
}
