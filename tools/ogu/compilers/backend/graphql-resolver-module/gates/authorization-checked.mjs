import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * GR005 — authorization-checked
 * Every non-public resolver must check authorization.
 * Look for: context.user, context.auth, requireAuth, isAuthenticated,
 * @auth directive, shield, or explicit checks.
 */

const AUTH_PATTERNS = [
  /context\s*\.\s*(?:user|auth|currentUser|viewer)\b/,
  /requireAuth|requireAuthorization|isAuthenticated|isAuthorized/i,
  /GraphQLShield|shield\s*\(/,
  /@auth\s*\(|@hasRole|@requiresAuth/,
  /throwIfNotAuthenticated|assertAuthenticated|checkAuth/i,
  /if\s*\(!?\s*context\.user/,
];

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
  const spec = JSON.parse(readFileSync(join(dir, 'graphql-resolver-spec.json'), 'utf8'));
  const protectedResolvers = spec.resolvers.filter(r => r.auth && r.auth !== 'public');

  if (protectedResolvers.length === 0) {
    return { pass: true, code: 'GR005', message: 'All resolvers declared public — auth check skipped', skipped: true };
  }

  const files = collectFiles(dir);
  const allContent = files.map(f => readFileSync(f, 'utf8')).join('\n');

  for (const pattern of AUTH_PATTERNS) {
    if (pattern.test(allContent)) return { pass: true, code: 'GR005', message: `Authorization checks found for ${protectedResolvers.length} protected resolver(s)` };
  }

  return {
    pass: false, code: 'GR005',
    message: `${protectedResolvers.length} protected resolver(s) but no auth check found`,
    detail: protectedResolvers.map(r => `${r.type}.${r.field} (auth: ${r.auth})`).join('\n') + '\n\nAdd: if (!context.user) throw new GraphQLError("Unauthorized", { extensions: { code: "UNAUTHORIZED" } });'
  };
}
