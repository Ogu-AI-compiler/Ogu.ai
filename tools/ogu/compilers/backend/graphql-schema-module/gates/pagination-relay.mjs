import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * GS005 — pagination-relay
 * If spec.pagination === 'relay', the schema must implement Relay connection spec:
 * - Connection types with edges[], node, pageInfo
 * - PageInfo type with hasNextPage, hasPreviousPage, startCursor, endCursor
 * If spec.pagination is not declared or 'offset', skip.
 */

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'graphql-schema-spec.json'), 'utf8'));
  if (!spec.pagination || spec.pagination !== 'relay') {
    return { pass: true, code: 'GS005', message: `Pagination style is "${spec.pagination || 'not relay'}" — Relay check skipped`, skipped: true };
  }

  const sdl = readFileSync(join(dir, spec.sdlFile), 'utf8');
  const RELAY_CHECKS = [
    { pattern: /type\s+PageInfo\s*\{/, name: 'PageInfo type' },
    { pattern: /hasNextPage\s*:\s*Boolean!/, name: 'hasNextPage field' },
    { pattern: /hasPreviousPage\s*:\s*Boolean!/, name: 'hasPreviousPage field' },
    { pattern: /\bedges\s*:\s*\[/, name: 'edges field' },
    { pattern: /\bnode\s*:\s*\w+/, name: 'node field in Edge' },
  ];

  const missing = RELAY_CHECKS.filter(({ pattern }) => !pattern.test(sdl)).map(({ name }) => name);

  if (missing.length) {
    return {
      pass: false, code: 'GS005',
      message: `Relay connection spec incomplete: missing ${missing.join(', ')}`,
      detail: 'Implement: type UserConnection { edges: [UserEdge], pageInfo: PageInfo! }\ntype UserEdge { node: User, cursor: String! }\ntype PageInfo { hasNextPage: Boolean!, hasPreviousPage: Boolean!, startCursor: String, endCursor: String }'
    };
  }

  return { pass: true, code: 'GS005', message: 'Relay connection spec implemented (PageInfo, edges, node)' };
}
