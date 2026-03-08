import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * GR004 — n-plus-one-guarded
 * Resolvers that return lists or resolve nested entity fields must use DataLoader or batch loading.
 * Check for DataLoader import or context.loaders usage.
 */

const DATALOADER_PATTERNS = [
  /DataLoader|dataloader/,
  /context\.loaders\./,
  /context\.dataSources\./,
  /\.load\s*\(/,
  /\.loadMany\s*\(/,
  /batch(?:Load|Fn|Function)/i,
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
  const hasListResolvers = spec.resolvers.some(r => r.isList || r.type !== 'Mutation');

  if (!hasListResolvers) return { pass: true, code: 'GR004', message: 'No list resolvers declared — N+1 check skipped', skipped: true };

  const files = collectFiles(dir);
  const allContent = files.map(f => readFileSync(f, 'utf8')).join('\n');

  for (const pattern of DATALOADER_PATTERNS) {
    if (pattern.test(allContent)) return { pass: true, code: 'GR004', message: `DataLoader/batch loading found (${files.length} file(s))` };
  }

  return {
    pass: false, code: 'GR004',
    message: 'No DataLoader or batch loading found — list resolvers will cause N+1 queries',
    detail: 'Use DataLoader: const userLoader = new DataLoader(async (ids) => batchLoadUsers(ids))\nOr context.loaders.user.load(id) in nested resolvers'
  };
}
