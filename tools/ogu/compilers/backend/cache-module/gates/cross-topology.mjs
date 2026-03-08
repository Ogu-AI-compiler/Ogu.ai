import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

/**
 * CA002 — cross-topology
 * If spec references a topologyArtifact, validate:
 * - artifact exists and is valid
 * - spec.namespace matches a declared namespace in the topology
 */

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'cache-spec.json'), 'utf8'));
  const topologyRef = spec.topologyArtifact;

  if (!topologyRef) {
    return { pass: true, code: 'CA002', message: 'No topologyArtifact referenced — cross-topology check skipped', skipped: true };
  }

  const artifactPath = resolve(dir, topologyRef);
  if (!existsSync(artifactPath)) {
    return {
      pass: false, code: 'CA002',
      message: `cache-topology-artifact not found: ${artifactPath}`,
      detail: 'Compile cache-topology-module first, or remove topologyArtifact from cache-spec.json'
    };
  }

  let topology;
  try {
    topology = JSON.parse(readFileSync(artifactPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'CA002', message: `Invalid cache-topology-artifact JSON: ${e.message}` };
  }

  const declaredNamespaces = (topology.families || []).map(f => f.namespace);
  if (!declaredNamespaces.includes(spec.namespace)) {
    return {
      pass: false, code: 'CA002',
      message: `Namespace "${spec.namespace}" not found in topology artifact`,
      detail: `Topology namespaces: ${declaredNamespaces.join(', ')}`
    };
  }

  return {
    pass: true, code: 'CA002',
    message: `Cross-topology valid — namespace "${spec.namespace}" found in topology`
  };
}
