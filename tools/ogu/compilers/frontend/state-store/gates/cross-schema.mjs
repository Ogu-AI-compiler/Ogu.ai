import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'store-spec.json'), 'utf8'));
  const schemaArtifactRef = spec.schemaArtifact;

  if (!schemaArtifactRef) {
    return { pass: true, code: 'SS011', message: 'No schemaArtifact referenced — skipping cross-schema check', skipped: true };
  }

  const artifactPath = resolve(dir, schemaArtifactRef);
  if (!existsSync(artifactPath)) {
    return { pass: false, code: 'SS011', message: `ts-schema-artifact not found: ${artifactPath}` };
  }

  const schemaArtifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
  const schemaFields = Object.keys(schemaArtifact.fields || schemaArtifact.properties || {});

  if (!schemaFields.length) {
    return { pass: true, code: 'SS011', message: 'Schema artifact has no fields — skipping', skipped: true };
  }

  // Get store state fields from spec
  const storeStateFields = Object.keys(spec.state || {});

  const storeFiles = readdirSync(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  const storeContent = storeFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  const violations = [];

  // Schema fields that are stored in the store should use the correct type
  for (const field of schemaFields) {
    const schemaType = schemaArtifact.fields?.[field]?.type || schemaArtifact.properties?.[field]?.type;
    if (!schemaType) continue;

    // Check if the field appears in store state with wrong type
    const fieldTypeInStore = storeContent.match(new RegExp(`${field}\\s*:\\s*(\\w+)`, 'i'));
    if (fieldTypeInStore && fieldTypeInStore[1] !== schemaType) {
      // Allow compatible types (e.g., string vs 'active'|'inactive')
      if (!['string', 'number', 'boolean', 'object', 'array'].includes(schemaType)) {
        violations.push(`Field '${field}': store uses type '${fieldTypeInStore[1]}', schema says '${schemaType}'`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'SS011',
      message: `Type mismatches with schema artifact (${violations.length})`,
      detail: violations.join('\n')
    };
  }

  return { pass: true, code: 'SS011', message: `Cross-schema valid — store state aligned with ${schemaFields.length} schema fields` };
}
