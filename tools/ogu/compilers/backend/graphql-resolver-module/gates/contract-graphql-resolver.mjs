import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
export async function run({ dir }) {
  const ap = join(dir, 'graphql-resolver-artifact.json');
  if (!existsSync(ap)) return { pass: false, code: 'GR009', message: 'graphql-resolver-artifact.json not found' };
  let a; try { a = JSON.parse(readFileSync(ap, 'utf8')); } catch (e) { return { pass: false, code: 'GR009', message: `Invalid JSON: ${e.message}` }; }
  const missing = ['ir_id','schemaName','resolverCount','attestation'].filter(k=>!(k in a));
  if (missing.length) return { pass: false, code: 'GR009', message: `Missing: ${missing.join(', ')}` };
  if (!a.ir_id.startsWith('GRAPHQL_RESOLVER:')) return { pass: false, code: 'GR009', message: 'ir_id must be GRAPHQL_RESOLVER:{schemaName}' };
  if (!a.attestation?.hash) return { pass: false, code: 'GR009', message: 'attestation.hash missing' };
  return { pass: true, code: 'GR009', message: `GraphQL resolver contract valid — ${a.schemaName}, ${a.resolverCount} resolver(s)` };
}
