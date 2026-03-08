import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * SC004 — auth-via-interceptor
 * Auth headers (Authorization, X-Api-Key, etc.) must be injected via an interceptor,
 * middleware, or factory function — not repeated per individual request call.
 *
 * Detection strategy:
 * - If auth.type is "none", pass immediately.
 * - Find all HTTP call sites (fetch, axios.get/post/etc, got, ky)
 * - If >1 call site sets Authorization/X-Api-Key headers directly → per-call injection detected
 * - Check for presence of interceptor patterns: axios.interceptors, ky.extend, got.extend, RequestInit factory
 */

const AUTH_HEADER_INLINE = /headers\s*[:{][^}]*(?:Authorization|X-Api-Key|x-api-key)[^}]*}/i;
const INTERCEPTOR_PATTERNS = [
  /\.interceptors\s*\.\s*request\s*\.\s*use/,
  /ky\.extend/,
  /got\.extend/,
  /new\s+Headers\s*\(/,
  /createAuthHeaders/,
  /withAuth/,
  /addAuthHeader/,
  /authInterceptor/,
  /injectAuth/,
];

function collectFiles(dir) {
  const files = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (['node_modules', 'dist', '.git', '__tests__', 'tests'].includes(e.name)) continue;
        walk(join(d, e.name));
      } else if (e.name.match(/\.(ts|mjs|js)$/) && !e.name.match(/\.(test|spec)\./)) {
        files.push(join(d, e.name));
      }
    }
  }
  walk(dir);
  return files;
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'service-client-spec.json'), 'utf8'));

  if (spec.auth?.type === 'none') {
    return { pass: true, code: 'SC004', message: 'auth.type is "none" — interceptor check skipped', skipped: true };
  }

  const files = collectFiles(dir);
  const inlineSites = [];
  let hasInterceptor = false;

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    if (INTERCEPTOR_PATTERNS.some(p => p.test(content))) {
      hasInterceptor = true;
    }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      if (AUTH_HEADER_INLINE.test(line)) {
        inlineSites.push(`${file.replace(dir + '/', '')}:${i + 1}`);
      }
    }
  }

  if (inlineSites.length > 1 && !hasInterceptor) {
    return {
      pass: false, code: 'SC004',
      message: `Auth header set inline in ${inlineSites.length} call sites — use interceptor/factory instead`,
      detail: inlineSites.slice(0, 10).join('\n')
    };
  }

  if (!hasInterceptor && inlineSites.length === 0 && spec.auth?.type !== 'none') {
    return {
      pass: false, code: 'SC004',
      message: 'No auth interceptor found and no auth header injection detected — auth must be declared somewhere',
      detail: 'Add axios.interceptors.request.use, ky.extend, or a createAuthHeaders factory'
    };
  }

  return {
    pass: true, code: 'SC004',
    message: hasInterceptor
      ? `Auth injected via interceptor/factory (${files.length} file(s) checked)`
      : `Auth appears in single call site only — acceptable (${files.length} file(s) checked)`
  };
}
