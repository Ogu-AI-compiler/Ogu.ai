import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * BT004 — no-shared-state
 * Tests must not share mutable module-level variables.
 * Pattern: a let/var declared at module level (outside describe/it/test)
 * that is mutated inside a test callback.
 *
 * Allowed: const at module level (immutable), let inside beforeEach (reset every test)
 * Forbidden: let x = [] at module top, then x.push(...) inside it(...)
 */

function findTestFiles(dir) {
  const files = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (['node_modules', 'dist', '.git'].includes(e.name)) continue;
        walk(join(d, e.name));
      } else if (e.name.match(/\.(test|spec)\.(ts|mjs|js)$/)) {
        files.push(join(d, e.name));
      }
    }
  }
  walk(dir);
  return files;
}

// Detect module-level let/var declarations (not inside function/describe/it blocks)
const MODULE_LET = /^(?:let|var)\s+(\w+)\s*(?:=|;)/;
// Detect mutation patterns inside test blocks
const MUTATION = /(?:\.push\(|\.pop\(|\.shift\(|\.splice\(|=\s*(?!\s*function))/;

export async function run({ dir }) {
  const testFiles = findTestFiles(dir);
  if (testFiles.length === 0) {
    return { pass: true, code: 'BT004', message: 'No test files found — shared state check skipped', skipped: true };
  }

  const violations = [];

  for (const file of testFiles) {
    const lines = readFileSync(file, 'utf8').split('\n');
    const moduleLevelVars = new Set();
    let depth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      depth += (line.match(/\{/g) || []).length;
      depth -= (line.match(/\}/g) || []).length;

      // Module-level declarations (depth 0 = outside all blocks)
      if (depth === 0) {
        const m = MODULE_LET.exec(line.trim());
        if (m) moduleLevelVars.add(m[1]);
      }

      // Inside test blocks (depth > 0): check for mutations of module-level vars
      if (depth > 0 && /\b(?:it|test|beforeAll)\s*\(/.test(line)) {
        // Check next 30 lines for mutations
        const window = lines.slice(i + 1, i + 31).join('\n');
        for (const varName of moduleLevelVars) {
          const mutationPattern = new RegExp(`\\b${varName}\\b.*(?:=|push|pop|shift|splice)`, 'g');
          if (mutationPattern.test(window)) {
            violations.push(`${file.replace(dir + '/', '')}:${i + 1} — module-level var "${varName}" mutated in test block`);
          }
        }
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'BT004',
      message: `${violations.length} shared mutable state violation(s)`,
      detail: violations.slice(0, 10).join('\n') + '\n\nMove mutable state into beforeEach to reset it between tests.'
    };
  }

  return { pass: true, code: 'BT004', message: `No shared mutable state detected (${testFiles.length} file(s) checked)` };
}
