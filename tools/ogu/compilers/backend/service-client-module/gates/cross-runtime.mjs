import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

/**
 * SC002 — cross-runtime
 * If spec references a clientRuntimeArtifact, validate that it exists and
 * the configured baseUrlKey matches something in the runtime's knownConfigKeys.
 * If no reference, skip (runtime may be external).
 */

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'service-client-spec.json'), 'utf8'));
  const runtimeRef = spec.clientRuntimeArtifact;

  if (!runtimeRef) {
    return { pass: true, code: 'SC002', message: 'No clientRuntimeArtifact referenced — cross-runtime check skipped', skipped: true };
  }

  const artifactPath = resolve(dir, runtimeRef);
  if (!existsSync(artifactPath)) {
    return {
      pass: false, code: 'SC002',
      message: `client-runtime-artifact not found: ${artifactPath}`,
      detail: 'Compile service-client-runtime-module first, or remove clientRuntimeArtifact from spec'
    };
  }

  let runtimeArtifact;
  try {
    runtimeArtifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'SC002', message: `Invalid client-runtime-artifact JSON: ${e.message}` };
  }

  const knownKeys = runtimeArtifact.knownConfigKeys || [];
  if (knownKeys.length > 0 && !knownKeys.includes(spec.baseUrlConfigKey)) {
    return {
      pass: false, code: 'SC002',
      message: `baseUrlConfigKey "${spec.baseUrlConfigKey}" not declared in runtime artifact`,
      detail: `Runtime known keys: ${knownKeys.join(', ')}`
    };
  }

  return {
    pass: true, code: 'SC002',
    message: `Cross-runtime valid — provider "${spec.provider}" uses runtime artifact`
  };
}
