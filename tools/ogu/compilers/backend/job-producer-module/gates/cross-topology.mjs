import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'job-producer-spec.json'), 'utf8'));
  const topologyRef = spec.topologyArtifact;

  if (!topologyRef) {
    return { pass: true, code: 'JP002', message: 'No topologyArtifact referenced — cross-topology check skipped', skipped: true };
  }

  const artifactPath = resolve(dir, topologyRef);
  if (!existsSync(artifactPath)) {
    return {
      pass: false, code: 'JP002',
      message: `queue-topology-artifact not found: ${artifactPath}`,
      detail: 'Compile queue-topology-module first, or remove topologyArtifact from spec'
    };
  }

  let topology;
  try {
    topology = JSON.parse(readFileSync(artifactPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'JP002', message: `Invalid queue-topology-artifact JSON: ${e.message}` };
  }

  const declaredQueues = (topology.queues || []).map(q => q.name);
  if (!declaredQueues.includes(spec.queueName)) {
    return {
      pass: false, code: 'JP002',
      message: `Queue "${spec.queueName}" not declared in topology artifact`,
      detail: `Topology queues: ${declaredQueues.join(', ')}`
    };
  }

  return {
    pass: true, code: 'JP002',
    message: `Cross-topology valid — queue "${spec.queueName}" found in topology`
  };
}
