import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
export async function run({ dir }) {
  const ap = join(dir, 'graphql-schema-artifact.json');
  if (!existsSync(ap)) return { pass: false, code: 'GS008', message: 'graphql-schema-artifact.json not found' };
  let a; try { a = JSON.parse(readFileSync(ap, 'utf8')); } catch (e) { return { pass: false, code: 'GS008', message: `Invalid JSON: ${e.message}` }; }
  const missing = ['ir_id','schemaName','entities','sdlFile','attestation'].filter(k=>!(k in a));
  if (missing.length) return { pass: false, code: 'GS008', message: `Missing: ${missing.join(', ')}` };
  if (!a.ir_id.startsWith('GRAPHQL_SCHEMA:')) return { pass: false, code: 'GS008', message: 'ir_id must be GRAPHQL_SCHEMA:{schemaName}' };
  if (!a.attestation?.hash) return { pass: false, code: 'GS008', message: 'attestation.hash missing' };
  return { pass: true, code: 'GS008', message: `GraphQL schema contract valid — ${a.schemaName}, entities: [${a.entities.join(', ')}]` };
}
