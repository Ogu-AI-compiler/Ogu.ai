/**
 * Gate: containers-have-resources (KW003)
 * Verifies that every container in the workload declares CPU and memory requests and
 * memory limits. Missing requests cause the scheduler to place the pod on any node
 * regardless of capacity. Missing limits allow memory leaks to consume node memory
 * until the OOM killer terminates other pods on the same node.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'k8s-workload-spec.json'), 'utf8'));
  const containers = spec.containers || [{ name: spec.name, image: spec.image, resources: spec.resources }];
  const violations = [];

  for (const container of containers) {
    const name = container.name || spec.name;

    if (!container.resources) {
      violations.push({ container: name, field: 'resources', reason: 'missing resources block — must declare requests and limits' });
      continue;
    }

    if (!container.resources.requests) {
      violations.push({ container: name, field: 'resources.requests', reason: 'missing — scheduler cannot make informed placement decisions without requests' });
    } else {
      if (!container.resources.requests.cpu)    violations.push({ container: name, field: 'resources.requests.cpu',    reason: 'missing CPU request' });
      if (!container.resources.requests.memory) violations.push({ container: name, field: 'resources.requests.memory', reason: 'missing memory request' });
    }

    if (!container.resources.limits) {
      violations.push({ container: name, field: 'resources.limits', reason: 'missing — without limits, a memory leak can OOM-kill other pods on the node' });
    } else {
      if (!container.resources.limits.memory) violations.push({ container: name, field: 'resources.limits.memory', reason: 'missing memory limit' });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'KW003',
      message: `${violations.length} resource constraint violation(s)`,
      detail: {
        violations,
        hint: 'Example: resources: { requests: { cpu: "100m", memory: "128Mi" }, limits: { memory: "256Mi" } }',
      },
    };
  }

  return {
    pass: true, code: 'KW003',
    message: `All ${containers.length} container(s) have resource requests and limits`,
  };
}
