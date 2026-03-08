import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
export async function run({ dir }) {
  const specPath = join(dir, 'graphql-schema-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'GS001', message: 'graphql-schema-spec.json not found' };
  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'GS001', message: `Invalid JSON: ${e.message}` }; }
  const required = ['schemaName', 'entities', 'sdlFile'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) return { pass: false, code: 'GS001', message: `Missing: ${missing.join(', ')}`, detail: 'Required: { schemaName, entities: string[], sdlFile: string (path to .graphql file) }' };
  if (!Array.isArray(spec.entities) || spec.entities.length === 0) return { pass: false, code: 'GS001', message: 'entities must be a non-empty array' };
  if (!existsSync(join(dir, spec.sdlFile))) return { pass: false, code: 'GS001', message: `sdlFile not found: ${spec.sdlFile}` };
  return { pass: true, code: 'GS001', message: `graphql-schema-spec.json valid — ${spec.schemaName}, entities: [${spec.entities.join(', ')}]` };
}
