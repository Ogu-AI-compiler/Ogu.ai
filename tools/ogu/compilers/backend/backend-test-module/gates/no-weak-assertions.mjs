import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * BT006 — no-weak-assertions
 * Tests must use specific value assertions, not just truthiness checks.
 *
 * Forbidden (alone): expect(x).toBeTruthy(), expect(x).toBeFalsy(), expect(x).toBeDefined()
 * when the test has no other assertion about the actual value.
 *
 * Allowed: expect(x).toBe(true), expect(x).toEqual({ id: '1' }), expect(x).toHaveLength(3)
 *
 * We flag: standalone toBeTruthy/toBeFalsy/toBeDefined with no value equality nearby.
 */

const WEAK = /expect\s*\([^)]+\)\s*\.\s*(?:toBeTruthy|toBeFalsy|toBeDefined)\s*\(\s*\)/;
const STRONG = /expect\s*\([^)]+\)\s*\.\s*(?:toBe|toEqual|toStrictEqual|toHaveLength|toContain|toMatchObject|toThrow|toHaveBeenCalledWith)\s*\(/;

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

export async function run({ dir }) {
  const testFiles = findTestFiles(dir);
  if (testFiles.length === 0) {
    return { pass: true, code: 'BT006', message: 'No test files found — assertion check skipped', skipped: true };
  }

  const violations = [];

  for (const file of testFiles) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');
    // If the file has strong assertions, weak assertions alongside are acceptable
    const hasStrong = STRONG.test(content);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      if (WEAK.test(line)) {
        // Check surrounding 5 lines for a strong assertion
        const window = lines.slice(Math.max(0, i - 3), i + 4).join('\n');
        if (!STRONG.test(window)) {
          violations.push(`${file.replace(dir + '/', '')}:${i + 1} — weak assertion with no value check nearby: ${line.trim().slice(0, 80)}`);
        }
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'BT006',
      message: `${violations.length} weak assertion(s) without value check`,
      detail: violations.slice(0, 10).join('\n') + '\n\nUse toBe(), toEqual(), toHaveLength(), etc. to check actual values.'
    };
  }

  return { pass: true, code: 'BT006', message: `No standalone weak assertions (${testFiles.length} file(s) checked)` };
}
