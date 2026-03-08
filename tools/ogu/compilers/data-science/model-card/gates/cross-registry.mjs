import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * MC007 — cross-registry
 * The model card must cross-reference a passing model registry entry,
 * ensuring the card documents an actual registered model, not a draft.
 *
 * Why:
 * - Model cards for unregistered models are speculative documentation.
 *   The card should document the model AS DEPLOYED, including the artifact
 *   path, version, and registry entry that production systems reference.
 * - The cross-reference creates a bidirectional link: model card → registry
 *   and registry → model card (via model-card-linked gate). Together,
 *   these links make the model's documentation graph navigable.
 * - Without the registry cross-reference, the model card cannot be
 *   automatically verified as current — it might document a previous version.
 *
 * Skipped gracefully if no registry artifact exists yet.
 */


export async function run({ dir, projectRoot }) {
  const root = projectRoot || dir;
  const artifactPaths = [
    join(root, 'model-registry-entry-artifact.json'),
    join(root, '.ogu', 'artifacts', 'model-registry-entry-artifact.json'),
  ];

  const artifactPath = artifactPaths.find(p => existsSync(p));
  if (!artifactPath) {
    return { pass: true, code: 'MC008', message: 'model-registry-entry-artifact.json not found — skipping cross-compiler check', skipped: true };
  }

  let artifact;
  try { artifact = JSON.parse(readFileSync(artifactPath, 'utf8')); } catch {
    return { pass: false, code: 'MC008', message: 'model-registry-entry-artifact.json is invalid JSON' };
  }

  if (!artifact.pass) {
    return {
      pass: false, code: 'MC008',
      message: 'model-registry-entry compiler did not pass — model card requires a passing registry entry',
      detail: `Registry failure: ${artifact.message || 'unknown'}`
    };
  }

  // Check that model card matches registry model name
  const specPath = join(dir, 'model-card-spec.json');
  if (existsSync(specPath) && existsSync(artifactPath)) {
    let cardSpec, registryArtifact;
    try {
      cardSpec = JSON.parse(readFileSync(specPath, 'utf8'));
      registryArtifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
    } catch {}

    if (cardSpec && registryArtifact && registryArtifact.model_name && cardSpec.model_name) {
      if (cardSpec.model_name !== registryArtifact.model_name) {
        return {
          pass: false, code: 'MC008',
          message: `Model name mismatch: card="${cardSpec.model_name}" vs registry="${registryArtifact.model_name}"`,
          detail: 'model_name in model-card-spec.json must match the registry entry'
        };
      }
    }
  }

  return { pass: true, code: 'MC008', message: 'Model registry entry passed and linked to model card' };
}
