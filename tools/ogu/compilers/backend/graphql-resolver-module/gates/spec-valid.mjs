import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
export async function run({ dir }) {
  const specPath = join(dir, 'graphql-resolver-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'GR001', message: 'graphql-resolver-spec.json not found' };
  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'GR001', message: `Invalid JSON: ${e.message}` }; }
  const required = ['schemaName', 'resolvers'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) return { pass: false, code: 'GR001', message: `Missing: ${missing.join(', ')}`, detail: 'Required: { schemaName, resolvers: [{ type, field, auth: "public"|"authenticated"|"role:X" }] }' };
  if (!Array.isArray(spec.resolvers) || spec.resolvers.length === 0) return { pass: false, code: 'GR001', message: 'resolvers must be a non-empty array' };
  const violations = [];
  for (const r of spec.resolvers) {
    if (!r.type || !r.field) violations.push(`Resolver missing type/field: ${JSON.stringify(r)}`);
    if (!r.auth) violations.push(`Resolver "${r.type}.${r.field}" missing auth declaration`);
  }
  if (violations.length) return { pass: false, code: 'GR001', message: `${violations.length} resolver spec error(s)`, detail: violations.join('\n') };
  return { pass: true, code: 'GR001', message: `graphql-resolver-spec.json valid — ${spec.resolvers.length} resolver(s)` };
}
