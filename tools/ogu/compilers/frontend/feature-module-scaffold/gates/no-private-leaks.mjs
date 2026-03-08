import { readFileSync, existsSync } from 'fs'; import { join } from 'path';
export async function run({ dir }) {
  const indexPath = join(dir, 'index.ts');
  if (!existsSync(indexPath)) return { pass: true, code: 'FM005', message: 'No barrel — private leak check skipped', skipped: true };
  const barrel = readFileSync(indexPath, 'utf8');
  // Look for exports of items with _ prefix (private convention)
  const privateExports = (barrel.match(/export\s+\{[^}]*_\w+[^}]*\}/g) || []);
  // Look for exports ending in Internal, Private, Impl
  const internalExports = (barrel.match(/export\s+\{[^}]*(Internal|Private|Impl)\w*[^}]*\}/g) || []);
  const leaks = [...privateExports, ...internalExports];
  if (leaks.length) return { pass: false, code: 'FM005', message: `${leaks.length} private symbol(s) leaked through barrel`, detail: leaks.join('\n') };
  return { pass: true, code: 'FM005', message: 'No private symbols exported through barrel' };
}
