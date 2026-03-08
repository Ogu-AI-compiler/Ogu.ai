import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA013 — no-assertion-free-tests
 * Detects test blocks (it/test) that contain no expect() call.
 * These are the most common coverage-cheating pattern: the test runs code,
 * coverage numbers go up, but nothing is actually asserted.
 *
 * Detection strategy:
 * - Walk all *.test.* and *.spec.* files
 * - For each it(...) / test(...) block, check if an expect() call appears
 *   within the next 40 lines
 * - Allow: it.skip, it.todo (intentionally unimplemented)
 * - Allow: expectation-less describe blocks (they contain inner its)
 *
 * This is a static heuristic, not full AST parsing. It catches the most
 * common patterns without requiring a TypeScript parser.
 *
 * Escape hatch: // @assertion-free-ok: reason
 */

function collectTestFiles(dir) {
  const files = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of entries) {
      if (f.isDirectory()) {
        if (!['node_modules', 'dist', '.git'].includes(f.name)) walk(join(d, f.name));
      } else if (f.name.match(/\.(test|spec)\.(ts|tsx|mjs|js)$/)) {
        files.push(join(d, f.name));
      }
    }
  }
  walk(dir);
  return files;
}

// Matches: it('...', => {, test('...', () => {, it(`...`, async () => {
// But not: it.skip, it.todo, it.each (those are intentional)
const IT_BLOCK_RE = /^\s*(?:it|test)\s*\(\s*[`'"][^`'"]*[`'"]\s*,\s*(?:async\s+)?(?:\(\)|[^=]+=>\s*\{|\(\)\s*\{)/;
const SKIP_TODO_RE = /^\s*(?:it|test)\.(?:skip|todo)\s*\(/;

export async function run({ dir, projectRoot }) {
  const searchRoot = projectRoot || dir;
  const testFiles = collectTestFiles(searchRoot);

  if (testFiles.length === 0) {
    return { pass: true, code: 'QA013', message: 'No test files found — skipped', skipped: true };
  }

  const violations = [];

  for (const file of testFiles) {
    const lines = readFileSync(file, 'utf8').split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip it.skip and it.todo
      if (SKIP_TODO_RE.test(line)) continue;

      if (!IT_BLOCK_RE.test(line)) continue;

      // Check escape hatch on or near this line
      const nearby = lines.slice(Math.max(0, i - 1), i + 3).join(' ');
      if (/@assertion-free-ok/.test(nearby)) continue;

      // Scan next 40 lines for any expect/assert call
      const window = lines.slice(i + 1, i + 41).join('\n');
      const hasExpect = /\bexpect\s*\(/.test(window)
        || /\bassert\s*[.(]/.test(window)
        || /\.toEqual\b|\.toBe\b|\.toMatch\b|\.toThrow\b|\.toHaveBeenCalled\b/.test(window);

      if (!hasExpect) {
        const shortLine = line.trim().slice(0, 60);
        violations.push(`${file.replace(searchRoot + '/', '')}:${i + 1} — ${shortLine}`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'QA013',
      message: `${violations.length} test block(s) with no expect() assertion`,
      detail: violations.slice(0, 15).join('\n') + '\n\nAdd assertions or mark with // @assertion-free-ok: reason',
    };
  }

  return {
    pass: true, code: 'QA013',
    message: `All test blocks have assertions (${testFiles.length} file(s) scanned)`,
  };
}
