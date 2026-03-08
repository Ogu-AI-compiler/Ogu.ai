/**
 * Gate: spec-valid (PC001)
 * Validates probe-config-spec.json exists, is valid JSON, and declares the required
 * containerPorts and probes fields. Without these the remaining gates cannot run.
 * The containerPorts are the source of truth for port references in probe handlers.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'probe-config-spec.json');
  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'PC001',
      message: 'probe-config-spec.json not found',
      detail: { hint: 'Create probe-config-spec.json with: { containerPorts: [{ name, port }], probes: { liveness?, readiness?, startup? } }' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return {
      pass: false, code: 'PC001',
      message: `probe-config-spec.json is not valid JSON: ${e.message}`,
      detail: { hint: 'Fix the JSON syntax error before re-running' },
    };
  }

  const missing = ['containerPorts', 'probes'].filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'PC001',
      message: `Missing required fields: ${missing.join(', ')}`,
      detail: {
        missing,
        hint: 'Required: { containerPorts: [{ name, port }], probes: { liveness?: {...}, readiness?: {...}, startup?: {...} } }',
      },
    };
  }

  if (!Array.isArray(spec.containerPorts) || spec.containerPorts.length === 0) {
    return {
      pass: false, code: 'PC001',
      message: 'containerPorts must be a non-empty array',
      detail: { hint: 'Add at least one port: [{ name: "http", port: 3000 }]' },
    };
  }

  return {
    pass: true, code: 'PC001',
    message: `probe-config-spec.json valid — ${spec.containerPorts.length} port(s)`,
  };
}
