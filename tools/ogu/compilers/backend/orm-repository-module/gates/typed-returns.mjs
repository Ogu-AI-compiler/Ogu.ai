import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * OR008 — typed-returns
 * Mutating methods (type: "write" or "delete" in spec) must not declare
 * `void` or `Promise<void>` return types.
 *
 * A write method must return the created/updated entity or a typed result:
 *   Promise<User>           — the mutated entity
 *   Promise<{ id: string }> — partial result
 *   Promise<UpdateResult>   — operation metadata
 *
 * Returning void from a write method:
 *   - Prevents callers from knowing if the operation succeeded
 *   - Cannot propagate the created entity's ID to the caller
 *   - Makes error handling impossible without exceptions
 */

function getRepoFiles(dir) {
  const results = [];

  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }

    for (const f of entries) {
      if (f.isDirectory()) {
        if (['node_modules', 'dist', '.git'].includes(f.name)) continue;
        walk(join(d, f.name));
      } else if (
        f.name.endsWith('.ts') &&
        !f.name.includes('.test.') &&
        !f.name.includes('.spec.') &&
        !f.name.match(/\.d\.ts$/) &&
        (f.name.includes('.repo.') || f.name.toLowerCase().includes('repository'))
      ) {
        results.push(join(d, f.name));
      }
    }
  }

  walk(dir);
  return results;
}

/** Escape special regex characters in a method name so it can be used in a RegExp */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function run({ dir }) {
  const specPath = join(dir, 'repository-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'OR008', message: 'repository-spec.json not found' };
  }

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'OR008', message: 'repository-spec.json is not valid JSON' }; }

  if (!Array.isArray(spec.methods)) {
    return { pass: false, code: 'OR008', message: 'repository-spec.json must have a methods[] array' };
  }

  const writeMethods = spec.methods.filter(m => m.type === 'write' || m.type === 'delete');
  if (writeMethods.length === 0) {
    return { pass: true, code: 'OR008', message: 'No write/delete methods declared — skipped', skipped: true };
  }

  const repoFiles = getRepoFiles(dir);
  if (repoFiles.length === 0) {
    return { pass: true, code: 'OR008', message: 'No repository files found — skipped', skipped: true };
  }

  const allContent = repoFiles.map(f => readFileSync(f, 'utf8')).join('\n');
  const violations = [];

  for (const method of writeMethods) {
    const safeName = escapeRegex(method.name);
    // Match: methodName(...): Promise<void>  OR  methodName(...): void
    const voidReturnRe = new RegExp(
      `${safeName}\\s*\\([^)]*\\)\\s*:\\s*Promise\\s*<\\s*void\\s*>` +
      `|${safeName}\\s*\\([^)]*\\)\\s*:\\s*void\\b`
    );
    if (voidReturnRe.test(allContent)) {
      violations.push(
        `"${method.name}" (${method.type}) returns void — ` +
        'must return the entity or a typed result (e.g. Promise<User>, Promise<UpdateResult>)'
      );
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'OR008',
      message: `${violations.length} mutating method(s) with void return type`,
      detail: violations.join('\n') +
        '\n\nExamples of correct return types:\n' +
        '  create(dto): Promise<User>\n' +
        '  update(id, dto): Promise<User>\n' +
        '  delete(id): Promise<{ deleted: boolean }>',
    };
  }

  return {
    pass: true, code: 'OR008',
    message: `All ${writeMethods.length} mutating method(s) have typed return types`,
  };
}
