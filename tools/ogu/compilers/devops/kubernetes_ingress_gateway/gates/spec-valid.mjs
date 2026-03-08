/**
 * Gate: spec-valid (KI001)
 * Validates k8s-ingress-spec.json exists, is valid JSON, and declares all required
 * fields. An Ingress with no rules routes no traffic. The kind must be a recognised
 * Kubernetes network routing resource if specified.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_KINDS = ['Ingress', 'Gateway', 'HTTPRoute', 'GRPCRoute'];

export async function run({ dir }) {
  const specPath = join(dir, 'k8s-ingress-spec.json');
  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'KI001',
      message: 'k8s-ingress-spec.json not found',
      detail: { hint: 'Create k8s-ingress-spec.json with: { name, rules: [{ host, paths: [{ path, backend: { service, port } }] }] }' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return {
      pass: false, code: 'KI001',
      message: `k8s-ingress-spec.json is not valid JSON: ${e.message}`,
      detail: { hint: 'Fix the JSON syntax error before re-running' },
    };
  }

  if (!spec.name) {
    return {
      pass: false, code: 'KI001',
      message: 'Missing required field: name',
      detail: { hint: 'Add name: "my-ingress" to the spec' },
    };
  }

  if (!Array.isArray(spec.rules) || spec.rules.length === 0) {
    return {
      pass: false, code: 'KI001',
      message: 'rules must be a non-empty array',
      detail: {
        hint: 'Required: { name, rules: [{ host, paths: [{ path, backend: { service, port } }] }], tls?: [{ hosts, secretName }] }',
      },
    };
  }

  if (spec.kind && !VALID_KINDS.includes(spec.kind)) {
    return {
      pass: false, code: 'KI001',
      message: `Invalid kind: "${spec.kind}"`,
      detail: { allowedValues: VALID_KINDS, received: spec.kind },
    };
  }

  return {
    pass: true, code: 'KI001',
    message: `k8s-ingress-spec.json valid — "${spec.name}", ${spec.rules.length} rule(s)`,
  };
}
