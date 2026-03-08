import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'graphql-resolver-spec.json'), 'utf8'));
  const ref = spec.schemaArtifact;
  if (!ref) return { pass: true, code: 'GR002', message: 'No schemaArtifact referenced — skipped', skipped: true };
  const ap = resolve(dir, ref);
  if (!existsSync(ap)) return { pass: false, code: 'GR002', message: `graphql-schema-artifact not found: ${ap}`, detail: 'Compile graphql-schema-module first' };
  let schema; try { schema = JSON.parse(readFileSync(ap, 'utf8')); } catch (e) { return { pass: false, code: 'GR002', message: `Invalid schema artifact: ${e.message}` }; }
  if (schema.schemaName !== spec.schemaName) return { pass: false, code: 'GR002', message: `schemaName mismatch: resolver "${spec.schemaName}" ≠ schema "${schema.schemaName}"` };
  return { pass: true, code: 'GR002', message: `Cross-schema valid — resolvers target "${spec.schemaName}"` };
}
