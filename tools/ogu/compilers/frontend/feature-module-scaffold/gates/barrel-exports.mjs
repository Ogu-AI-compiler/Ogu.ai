import { readFileSync, existsSync, readdirSync } from 'fs'; import { join } from 'path';
export async function run({ dir }) {
  const indexPath = join(dir, 'index.ts');
  if (!existsSync(indexPath)) return { pass: false, code: 'FM002', message: 'index.ts barrel file not found — feature module must have a barrel export' };
  const content = readFileSync(indexPath, 'utf8');
  const exports = (content.match(/^export\s/mg) || []).length;
  if (!exports) return { pass: false, code: 'FM002', message: 'index.ts has no exports — barrel must re-export public API' };
  // Check for wildcard re-exports (anti-pattern)
  const hasWildcard = /export\s*\*\s*from/.test(content);
  if (hasWildcard) return { pass: false, code: 'FM002', message: 'Barrel uses export * — use named exports to keep public API explicit' };
  return { pass: true, code: 'FM002', message: `Barrel exports ${exports} named symbol(s)` };
}
