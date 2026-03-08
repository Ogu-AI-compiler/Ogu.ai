import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * SC006 — error-mapped
 * Non-2xx responses must be caught and mapped to typed error classes.
 * Check: if there's a fetch/axios/got call, there must be error handling that
 * references a typed error class (not just `throw err` or `throw new Error`).
 */

const HTTP_CALL = /\b(?:fetch|axios|got|ky)\s*[.(]/;
const THROW_GENERIC = /throw\s+new\s+Error\s*\(/;
const THROW_TYPED = /throw\s+new\s+\w*(?:Error|Exception|Failure|Problem)\s*\(/;
const ERROR_CLASS_DECL = /class\s+\w+(?:Error|Exception|Failure|Problem)\s+extends\s+Error/;
const INSTANCEOF_TYPED = /instanceof\s+\w+(?:Error|Exception|Failure|Problem)/;

function collectFiles(dir) {
  const files = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (['node_modules', 'dist', '.git', '__tests__', 'tests'].includes(e.name)) continue;
        walk(join(d, e.name));
      } else if (e.name.match(/\.(ts|mjs|js)$/) && !e.name.match(/\.(test|spec|d)\./)) {
        files.push(join(d, e.name));
      }
    }
  }
  walk(dir);
  return files;
}

export async function run({ dir }) {
  const files = collectFiles(dir);
  if (files.length === 0) {
    return { pass: false, code: 'SC006', message: 'No client files found' };
  }

  let hasHttpCall = false;
  let hasTypedErrorClass = false;
  let hasTypedThrow = false;
  let hasOnlyGenericThrows = false;
  const genericThrowSites = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    if (HTTP_CALL.test(content)) hasHttpCall = true;
    if (ERROR_CLASS_DECL.test(content) || INSTANCEOF_TYPED.test(content)) hasTypedErrorClass = true;
    if (THROW_TYPED.test(content)) hasTypedThrow = true;

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      if (THROW_GENERIC.test(line) && !THROW_TYPED.test(line)) {
        genericThrowSites.push(`${file.replace(dir + '/', '')}:${i + 1}`);
      }
    }
  }

  if (!hasHttpCall) {
    return { pass: true, code: 'SC006', message: 'No HTTP calls found — error mapping check skipped', skipped: true };
  }

  if (!hasTypedErrorClass && !hasTypedThrow) {
    return {
      pass: false, code: 'SC006',
      message: 'No typed error class found — non-2xx responses must map to typed errors',
      detail: 'Define a class like: class ProviderApiError extends Error { constructor(public status: number, ...) }'
    };
  }

  if (genericThrowSites.length > 0 && !hasTypedErrorClass) {
    return {
      pass: false, code: 'SC006',
      message: `${genericThrowSites.length} generic Error throw(s) without typed error class`,
      detail: genericThrowSites.slice(0, 10).join('\n')
    };
  }

  return {
    pass: true, code: 'SC006',
    message: `Error mapping present — typed error class found (${files.length} file(s) checked)`
  };
}
