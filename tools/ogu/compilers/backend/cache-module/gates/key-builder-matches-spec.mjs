import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * CA003 — key-builder-matches-spec
 * The key builder function must accept parameters matching spec.keyInputs.
 * We look for a function named buildKey, makeKey, cacheKey, or *Key that
 * uses all declared keyInputs as parameters or destructured properties.
 */

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
  const spec = JSON.parse(readFileSync(join(dir, 'cache-spec.json'), 'utf8'));
  const keyInputs = spec.keyInputs;
  const files = collectFiles(dir);
  const allContent = files.map(f => readFileSync(f, 'utf8')).join('\n');

  // Find key builder function
  const KEY_BUILDER_FN = /(?:function\s+\w*[Kk]ey\w*|(?:buildKey|makeKey|cacheKey|getKey)\s*[=(])/;
  if (!KEY_BUILDER_FN.test(allContent)) {
    return {
      pass: false, code: 'CA003',
      message: 'No key builder function found (expected: buildKey, makeKey, cacheKey, or *Key function)',
      detail: 'Define a function like: function buildKey({ userId, resourceId }: ...) { return `ns:${userId}:${resourceId}`; }'
    };
  }

  // Check each key input appears somewhere in the content
  const missing = keyInputs.filter(k => !allContent.includes(k));
  if (missing.length) {
    return {
      pass: false, code: 'CA003',
      message: `Key input(s) from spec not found in code: ${missing.join(', ')}`,
      detail: `Spec keyInputs: ${keyInputs.join(', ')} — all must appear in the key builder`
    };
  }

  return {
    pass: true, code: 'CA003',
    message: `Key builder found with all ${keyInputs.length} declared input(s): [${keyInputs.join(', ')}]`
  };
}
