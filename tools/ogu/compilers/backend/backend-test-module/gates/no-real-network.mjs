import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * BT003 — no-real-network
 * Unit test files must not make real network calls.
 * Allowed: MSW, vi.mock, jest.mock, nock
 * Forbidden in test files: fetch(, axios.get(, axios.post(, http.request(, https.request(
 * unless immediately preceded by a mock setup.
 */

const REAL_CALL = /\b(?:fetch|axios\.(?:get|post|put|patch|delete|request)|http\.request|https\.request|got\(|ky\.)\s*\(/;
const MOCK_SETUP = /(?:vi\.mock|jest\.mock|nock|msw|setupServer|interceptors\.request)/;

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
    return { pass: true, code: 'BT003', message: 'No test files found — network check skipped', skipped: true };
  }

  const violations = [];

  for (const file of testFiles) {
    const content = readFileSync(file, 'utf8');
    // If file mocks network at module level, it's fine
    if (MOCK_SETUP.test(content)) continue;

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      if (REAL_CALL.test(line)) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — real network call in test without mock setup`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'BT003',
      message: `${violations.length} real network call(s) in unit tests`,
      detail: violations.slice(0, 10).join('\n') + '\n\nUse vi.mock, jest.mock, nock, or MSW to intercept HTTP in tests.'
    };
  }

  return { pass: true, code: 'BT003', message: `No real network calls in ${testFiles.length} test file(s)` };
}
