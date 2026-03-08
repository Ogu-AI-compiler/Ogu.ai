/**
 * Gate: spec-valid (KW001)
 * Validates k8s-workload-spec.json exists, is valid JSON, and declares all required
 * fields with correct types. The kind must be a recognised Kubernetes workload type,
 * and replicas must be a non-negative integer. This gate is the prerequisite for all
 * other kubernetes_workload gates.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_KINDS = ['Deployment', 'StatefulSet', 'DaemonSet'];

export async function run({ dir }) {
  const specPath = join(dir, 'k8s-workload-spec.json');
  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'KW001',
      message: 'k8s-workload-spec.json not found',
      detail: { hint: 'Create k8s-workload-spec.json with: { name, kind, image, replicas }' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return {
      pass: false, code: 'KW001',
      message: `k8s-workload-spec.json is not valid JSON: ${e.message}`,
      detail: { hint: 'Fix the JSON syntax error before re-running' },
    };
  }

  const missing = ['name', 'kind', 'image', 'replicas'].filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'KW001',
      message: `Missing required fields: ${missing.join(', ')}`,
      detail: {
        missing,
        hint: 'Required: { name, kind: "Deployment"|"StatefulSet"|"DaemonSet", image, replicas, ports?: [], resources?: { requests, limits } }',
      },
    };
  }

  if (!VALID_KINDS.includes(spec.kind)) {
    return {
      pass: false, code: 'KW001',
      message: `Invalid kind: "${spec.kind}"`,
      detail: { allowedValues: VALID_KINDS, received: spec.kind },
    };
  }

  if (typeof spec.replicas !== 'number' || !Number.isInteger(spec.replicas) || spec.replicas < 0) {
    return {
      pass: false, code: 'KW001',
      message: 'replicas must be a non-negative integer',
      detail: { received: spec.replicas, hint: 'Examples: 1 (single), 2 (HA), 0 (scaled down)' },
    };
  }

  return {
    pass: true, code: 'KW001',
    message: `k8s-workload-spec.json valid — ${spec.kind} "${spec.name}" (${spec.replicas} replica(s))`,
  };
}
