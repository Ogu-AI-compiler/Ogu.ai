/**
 * Gate: spec-valid (DF001)
 * Validates that dockerfile-spec.json exists, is valid JSON, and contains all required
 * fields with correct types. The spec is the ground truth for all other Dockerfile
 * gates — if it is absent or malformed, no further analysis is possible.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_RUNTIMES = ['node', 'python', 'go', 'java', 'ruby', 'rust', 'dotnet', 'php', 'bun', 'deno'];

export async function run({ dir }) {
  const specPath = join(dir, 'dockerfile-spec.json');
  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'DF001',
      message: 'dockerfile-spec.json not found',
      detail: { hint: 'Create dockerfile-spec.json with: { runtime, entrypoint, ports: [] }' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return {
      pass: false, code: 'DF001',
      message: `dockerfile-spec.json is not valid JSON: ${e.message}`,
      detail: { hint: 'Fix the JSON syntax error — run `node -e "JSON.parse(require(\'fs\').readFileSync(\'dockerfile-spec.json\',\'utf8\'))"` to locate it' },
    };
  }

  const missing = ['runtime', 'entrypoint', 'ports'].filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'DF001',
      message: `Missing required fields: ${missing.join(', ')}`,
      detail: {
        missing,
        hint: 'Required shape: { runtime: string, entrypoint: string, ports: number[], packageManager?: string }',
      },
    };
  }

  if (!Array.isArray(spec.ports)) {
    return {
      pass: false, code: 'DF001',
      message: 'ports must be an array of numbers',
      detail: { received: typeof spec.ports, hint: 'Example: "ports": [3000, 9229]' },
    };
  }

  const invalidPorts = spec.ports.filter(p => !Number.isInteger(p) || p < 1 || p > 65535);
  if (invalidPorts.length) {
    return {
      pass: false, code: 'DF001',
      message: `Invalid port numbers: ${invalidPorts.join(', ')}`,
      detail: { invalidPorts, hint: 'Ports must be integers between 1 and 65535' },
    };
  }

  return {
    pass: true, code: 'DF001',
    message: `dockerfile-spec.json valid — runtime: ${spec.runtime}, ports: [${spec.ports.join(', ')}]`,
  };
}
