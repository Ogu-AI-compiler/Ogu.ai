import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * GS004 — mutations-return-payload
 * Mutations must return dedicated payload types, not root entities directly.
 * FORBIDDEN: createUser: User!
 * ALLOWED:   createUser: CreateUserPayload!
 */

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'graphql-schema-spec.json'), 'utf8'));
  const sdl = readFileSync(join(dir, spec.sdlFile), 'utf8');

  // Find Mutation block
  const mutationMatch = /type\s+Mutation\s*\{([^}]+)\}/s.exec(sdl);
  if (!mutationMatch) return { pass: true, code: 'GS004', message: 'No Mutation type found — check skipped', skipped: true };

  const mutationBody = mutationMatch[1];
  const mutations = mutationBody.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
  const violations = [];

  // Entity names from spec
  const entityNames = new Set(spec.entities);

  for (const line of mutations) {
    const returnTypeMatch = /:\s*(\w+)!?\s*(?:@|$)/.exec(line);
    if (!returnTypeMatch) continue;
    const returnType = returnTypeMatch[1];

    // If return type is directly an entity name (not a payload type)
    if (entityNames.has(returnType) && !returnType.endsWith('Payload') && !returnType.endsWith('Result') && !returnType.endsWith('Response')) {
      violations.push(`Mutation returns entity directly: ${line.trim()} — should return ${returnType}Payload`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'GS004',
      message: `${violations.length} mutation(s) return entity directly`,
      detail: violations.join('\n') + '\n\nReturn payload types: createUser: CreateUserPayload! { user: User, errors: [Error] }'
    };
  }

  return { pass: true, code: 'GS004', message: `All mutations return payload types` };
}
