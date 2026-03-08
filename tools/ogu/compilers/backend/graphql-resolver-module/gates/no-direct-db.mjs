import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * GR003 — no-direct-db
 * Resolvers must not call DB/ORM directly. They must go through a service layer.
 * FORBIDDEN: prisma.user.findMany(), db.query(), knex('users').select()
 * ALLOWED: userService.getUsers(), context.loaders.user.load(id)
 */

const DIRECT_DB = /\b(?:prisma|db|knex|drizzle|typeorm)\s*\.\s*\w+\s*\.\s*(?:findMany|findOne|findUnique|create|update|delete|upsert|query|raw)\s*\(/i;
const ESCAPE = /@direct-db-ok/;

function collectResolverFiles(dir) {
  const files = [];
  function walk(d) {
    let e; try { e = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of e) {
      if (f.isDirectory()) { if (!['node_modules','dist','.git','__tests__','tests'].includes(f.name)) walk(join(d,f.name)); }
      else if (f.name.match(/resolver/i) && f.name.match(/\.(ts|mjs|js)$/) && !f.name.match(/\.(test|spec|d)\./)) files.push(join(d,f.name));
    }
  }
  walk(dir);
  if (files.length === 0) {
    function walk2(d) {
      let e; try { e = readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const f of e) {
        if (f.isDirectory()) { if (!['node_modules','dist','.git','__tests__','tests'].includes(f.name)) walk2(join(d,f.name)); }
        else if (f.name.match(/\.(ts|mjs|js)$/) && !f.name.match(/\.(test|spec|d)\./)) files.push(join(d,f.name));
      }
    }
    walk2(dir);
  }
  return files;
}

export async function run({ dir }) {
  const files = collectResolverFiles(dir);
  const violations = [];
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//') || ESCAPE.test(line)) continue;
      if (DIRECT_DB.test(line)) violations.push(`${file.replace(dir+'/', '')}:${i+1} — direct DB call in resolver: ${line.trim().slice(0,80)}`);
    }
  }
  if (violations.length) return { pass: false, code: 'GR003', message: `${violations.length} direct DB call(s) in resolvers`, detail: violations.slice(0,10).join('\n') + '\n\nUse service layer: context.services.user.getUser(id)' };
  return { pass: true, code: 'GR003', message: `No direct DB in resolvers (${files.length} file(s))` };
}
