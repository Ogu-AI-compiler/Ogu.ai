/**
 * Gate: spec-valid (IAC001)
 * Validates iac-spec.json exists, is valid JSON, and declares all required top-level
 * fields with recognised values. The spec drives all other IAC gates — a malformed or
 * incomplete spec makes the entire compiler undefined.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_PLATFORMS = ['terraform', 'pulumi', 'cdk', 'ansible', 'crossplane'];
const VALID_CLOUDS    = ['aws', 'gcp', 'azure', 'digitalocean', 'cloudflare', 'multi'];

export async function run({ dir }) {
  const specPath = join(dir, 'iac-spec.json');
  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'IAC001',
      message: 'iac-spec.json not found',
      detail: { hint: 'Create iac-spec.json with: { platform, cloud, environments: [], stateBackend, inputs?: [], outputs?: [] }' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return {
      pass: false, code: 'IAC001',
      message: `iac-spec.json is not valid JSON: ${e.message}`,
      detail: { hint: 'Fix the JSON syntax error before re-running' },
    };
  }

  const missing = ['platform', 'cloud', 'environments', 'stateBackend'].filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'IAC001',
      message: `Missing required fields: ${missing.join(', ')}`,
      detail: {
        missing,
        hint: 'Required: { platform: "terraform"|"pulumi"|"cdk", cloud: "aws"|"gcp"|"azure", environments: string[], stateBackend: string }',
      },
    };
  }

  if (!VALID_PLATFORMS.includes(spec.platform)) {
    return {
      pass: false, code: 'IAC001',
      message: `Invalid platform: "${spec.platform}"`,
      detail: { allowedValues: VALID_PLATFORMS, received: spec.platform },
    };
  }

  if (!VALID_CLOUDS.includes(spec.cloud)) {
    return {
      pass: false, code: 'IAC001',
      message: `Invalid cloud: "${spec.cloud}"`,
      detail: { allowedValues: VALID_CLOUDS, received: spec.cloud },
    };
  }

  if (!Array.isArray(spec.environments) || spec.environments.length === 0) {
    return {
      pass: false, code: 'IAC001',
      message: 'environments must be a non-empty array',
      detail: { hint: 'Example: ["staging", "production"]' },
    };
  }

  return {
    pass: true, code: 'IAC001',
    message: `iac-spec.json valid — ${spec.platform} on ${spec.cloud} (${spec.environments.join(', ')})`,
  };
}
