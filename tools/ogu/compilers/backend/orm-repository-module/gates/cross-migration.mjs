import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

/**
 * OR002 — cross-migration
 * If migration-artifact.json is referenced in spec, validate that the entity table exists.
 * If not referenced, skip (the migration may be managed externally).
 */

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'repository-spec.json'), 'utf8'));
  const migrationRef = spec.migrationArtifact;

  if (!migrationRef) {
    return { pass: true, code: 'OR002', message: 'No migrationArtifact referenced — cross-migration check skipped', skipped: true };
  }

  const artifactPath = resolve(dir, migrationRef);
  if (!existsSync(artifactPath)) {
    return {
      pass: false, code: 'OR002',
      message: `migration-artifact not found: ${artifactPath}`,
      detail: 'Compile db-migration first, or remove migrationArtifact from repository-spec.json'
    };
  }

  let migrationArtifact;
  try {
    migrationArtifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'OR002', message: `Invalid migration-artifact JSON: ${e.message}` };
  }

  const entityTable = spec.entity.toLowerCase() + 's'; // naive pluralization
  const artifactTable = migrationArtifact.table?.toLowerCase();

  if (artifactTable && artifactTable !== entityTable && artifactTable !== spec.entity.toLowerCase()) {
    return {
      pass: false, code: 'OR002',
      message: `Repository entity "${spec.entity}" does not match migration table "${migrationArtifact.table}"`,
      detail: 'Repository must target the same table as the compiled migration'
    };
  }

  return {
    pass: true, code: 'OR002',
    message: `Cross-migration valid — entity "${spec.entity}" matches migration artifact`
  };
}
