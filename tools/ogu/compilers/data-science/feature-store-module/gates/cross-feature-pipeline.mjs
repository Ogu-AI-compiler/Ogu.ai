import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * FS007 — cross-feature-pipeline
 * Feature store modules must verify that an upstream feature-pipeline
 * compiler artifact exists and passed, ensuring features are properly engineered
 * before being registered in the store.
 *
 * Why:
 * - The feature store is downstream of the feature pipeline. Registering
 *   features before the pipeline is validated means the store may contain
 *   features computed by an unvalidated (potentially buggy) pipeline.
 * - The artifact chain enforces build order:
 *   feature-pipeline → feature-store-module
 *   If the pipeline failed, the store must not receive its output.
 * - This gate is the mechanism for compiler-level dependency enforcement.
 *
 * Skipped gracefully if no pipeline artifact exists yet.
 */


export async function run({ dir, projectRoot }) {
  // Check that upstream feature-pipeline artifact exists
  const root = projectRoot || dir;
  const artifactPaths = [
    join(root, 'feature-pipeline-artifact.json'),
    join(root, '.ogu', 'artifacts', 'feature-pipeline-artifact.json'),
  ];

  const artifactPath = artifactPaths.find(p => existsSync(p));
  if (!artifactPath) {
    return { pass: true, code: 'FS007', message: 'feature-pipeline-artifact.json not found — skipping cross-compiler check', skipped: true };
  }

  let artifact;
  try { artifact = JSON.parse(readFileSync(artifactPath, 'utf8')); } catch {
    return { pass: false, code: 'FS007', message: 'feature-pipeline-artifact.json is invalid JSON' };
  }

  if (!artifact.pass) {
    return {
      pass: false, code: 'FS007',
      message: 'feature-pipeline compiler did not pass — feature store cannot be registered with failed pipeline',
      detail: `Upstream failure: ${artifact.message || 'unknown'}`
    };
  }

  return { pass: true, code: 'FS007', message: `Upstream feature-pipeline compiler passed (${artifact.gatesRun || '?'} gates)` };
}
