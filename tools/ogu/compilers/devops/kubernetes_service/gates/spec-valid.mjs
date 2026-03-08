/**
 * Gate: spec-valid (KS001)
 * Validates that k8s-service-spec.json exists, is valid JSON, and declares all
 * required fields. A Service without a selector cannot route traffic, and a Service
 * without ports does nothing. This gate is the prerequisite for all other gates.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'k8s-service-spec.json');
  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'KS001',
      message: 'k8s-service-spec.json not found',
      detail: { hint: 'Create k8s-service-spec.json with: { name, selector: { app: "..." }, ports: [{ port, targetPort }] }' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return {
      pass: false, code: 'KS001',
      message: `k8s-service-spec.json is not valid JSON: ${e.message}`,
      detail: { hint: 'Fix the JSON syntax error before re-running' },
    };
  }

  const missing = ['name', 'selector', 'ports'].filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'KS001',
      message: `Missing required fields: ${missing.join(', ')}`,
      detail: {
        missing,
        hint: 'Required: { name, selector: { app: string }, ports: [{ port, targetPort, protocol? }], type?: "ClusterIP"|"LoadBalancer" }',
      },
    };
  }

  if (!Array.isArray(spec.ports) || spec.ports.length === 0) {
    return {
      pass: false, code: 'KS001',
      message: 'ports must be a non-empty array',
      detail: { hint: 'Add at least one port entry: { port: 80, targetPort: 3000 }' },
    };
  }

  return {
    pass: true, code: 'KS001',
    message: `k8s-service-spec.json valid — "${spec.name}", ${spec.ports.length} port(s)`,
  };
}
