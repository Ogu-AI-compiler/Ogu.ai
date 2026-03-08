import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * GR006 — errors-mapped-to-graphql
 * Resolvers must throw GraphQLError (with extensions.code), not raw Error.
 * Raw errors expose stack traces and internal details.
 */

const GRAPHQL_ERROR = /GraphQLError|ApolloError|new.*Error.*extensions\s*:/i;
const RAW_THROW = /throw\s+new\s+Error\s*\(/;
const IN_RESOLVER = /(?:resolver|Resolver|Query|Mutation|Subscription)/;

function collectFiles(dir) {
  const files = [];
  function walk(d) {
    let e; try { e = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of e) {
      if (f.isDirectory()) { if (!['node_modules','dist','.git','__tests__','tests'].includes(f.name)) walk(join(d,f.name)); }
      else if (f.name.match(/\.(ts|mjs|js)$/) && !f.name.match(/\.(test|spec|d)\./)) files.push(join(d,f.name));
    }
  }
  walk(dir);
  return files;
}

export async function run({ dir }) {
  const files = collectFiles(dir);
  let hasGraphQLError = false;
  const rawThrows = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    if (!IN_RESOLVER.test(file) && !IN_RESOLVER.test(content)) continue;
    if (GRAPHQL_ERROR.test(content)) hasGraphQLError = true;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (RAW_THROW.test(lines[i]) && !lines[i].includes('//')) rawThrows.push(`${file.replace(dir+'/', '')}:${i+1}`);
    }
  }

  if (!hasGraphQLError && rawThrows.length > 0) {
    return {
      pass: false, code: 'GR006',
      message: `${rawThrows.length} raw Error throw(s) in resolvers without GraphQLError`,
      detail: rawThrows.slice(0,10).join('\n') + '\n\nUse: throw new GraphQLError("Not found", { extensions: { code: "NOT_FOUND" } })'
    };
  }

  return { pass: true, code: 'GR006', message: `GraphQLError mapping present (${files.length} file(s))` };
}
