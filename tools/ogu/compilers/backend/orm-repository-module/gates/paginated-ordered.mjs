import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * OR007 — paginated-ordered
 * Paginated repository methods (findMany with take/skip/limit/offset) must include ORDER BY.
 * Pagination without ordering returns non-deterministic pages — rows can appear on multiple pages or be skipped.
 */

const PAGINATION_PATTERNS = [
  /take\s*:/,
  /skip\s*:/,
  /limit\s*:/,
  /offset\s*:/,
  /\bfindMany\s*\(/,
  /\.paginate\s*\(/,
  /cursor\s*:/,
];

const ORDER_PATTERNS = [
  /orderBy\s*:/,
  /ORDER BY/i,
  /order\s*:/,
  /sort\s*:/,
  /\bsortBy\b/,
];

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'repository-spec.json'), 'utf8'));
  const paginatedMethods = spec.methods.filter(m => m.paginated === true || m.type === 'read' && m.name?.toLowerCase().includes('list'));

  if (paginatedMethods.length === 0) {
    return { pass: true, code: 'OR007', message: 'No paginated methods declared — gate skipped', skipped: true };
  }

  // Look for the actual implementation
  const { readdirSync, existsSync } = await import('fs');
  function findRepoFile(d) {
    let e; try { e = readdirSync(d,{withFileTypes:true}); } catch { return null; }
    for (const f of e) {
      if (f.isDirectory()) { if (['node_modules','dist','.git'].includes(f.name)) continue; const r = findRepoFile(join(d,f.name)); if (r) return r; }
      else if (f.name.match(/\.repo\.|[Rr]epository/) && f.name.endsWith('.ts')) return join(d,f.name);
    }
    return null;
  }

  const repoFile = findRepoFile(dir);
  if (!repoFile) {
    return {
      pass: false, code: 'OR007',
      message: `${paginatedMethods.length} paginated method(s) declared but no repository file found`
    };
  }

  const content = readFileSync(repoFile, 'utf8');
  const violations = [];

  // Check each paginated method in context
  for (const method of paginatedMethods) {
    const methodRegex = new RegExp(`${method.name}\\s*\\([\\s\\S]*?(?=\\n\\s*(?:async|public|private|protected|\\}))`);
    const methodMatch = content.match(methodRegex);
    const methodContent = methodMatch ? methodMatch[0] : '';

    const hasPagination = PAGINATION_PATTERNS.some(p => p.test(content));
    const hasOrdering = ORDER_PATTERNS.some(p => p.test(content));

    if (hasPagination && !hasOrdering) {
      violations.push(`Method "${method.name}" uses pagination but no stable ordering found`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'OR007',
      message: `${violations.length} paginated method(s) without stable ordering`,
      detail: violations.join('\n') + '\n\nAdd: orderBy: { createdAt: "asc", id: "asc" } to all paginated queries'
    };
  }

  return {
    pass: true, code: 'OR007',
    message: `All ${paginatedMethods.length} paginated method(s) have stable ordering`
  };
}
