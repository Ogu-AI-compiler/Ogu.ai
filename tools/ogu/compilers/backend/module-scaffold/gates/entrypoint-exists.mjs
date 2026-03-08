import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * MS002 — entrypoint-exists
 * Every module must have exactly one public entrypoint: src/modules/{name}/index.ts
 * It must export the module's public API (at least one named export).
 */

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'module-spec.json'), 'utf8'));
  const moduleName = spec.name;

  // Look for index.ts in common locations
  const candidates = [
    join(dir, 'src', 'modules', moduleName, 'index.ts'),
    join(dir, 'src', moduleName, 'index.ts'),
    join(dir, moduleName, 'index.ts'),
    join(dir, 'index.ts'),
  ];

  let entrypointPath = null;
  for (const p of candidates) {
    if (existsSync(p)) { entrypointPath = p; break; }
  }

  if (!entrypointPath) {
    return {
      pass: false, code: 'MS002',
      message: `Module entrypoint not found for "${moduleName}"`,
      detail: `Expected: src/modules/${moduleName}/index.ts\nThis file is the single public API surface of the module.`
    };
  }

  const content = readFileSync(entrypointPath, 'utf8');

  // Must have at least one export
  const hasExport = /export\s+(const|function|class|type|interface|default|\{)/.test(content);
  if (!hasExport) {
    return {
      pass: false, code: 'MS002',
      message: `${entrypointPath.replace(dir + '/', '')} exists but has no exports`,
      detail: 'The module entrypoint must export the public API. Add: export { MyService } from "./services/my.service";'
    };
  }

  // Must not re-export internal implementation details (no wildcard re-exports of internal folders)
  const hasWildcardInternal = /export \* from ['"]\.\/(?:services|repositories|workflows|clients|events|jobs|webhooks|cache)\//.test(content);
  if (hasWildcardInternal) {
    return {
      pass: false, code: 'MS002',
      message: 'Module entrypoint uses wildcard re-exports from internal folders',
      detail: 'Use named re-exports: export { MyService } from "./services/my.service" — never export *'
    };
  }

  return {
    pass: true, code: 'MS002',
    message: `Module entrypoint valid: ${entrypointPath.replace(dir + '/', '')}`
  };
}
