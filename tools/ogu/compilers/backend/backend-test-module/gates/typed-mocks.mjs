import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * BT005 — typed-mocks
 * Mock return values must be typed, not implicitly `any`.
 * Forbidden: vi.fn().mockResolvedValue({} as any), jest.fn().mockReturnValue(anything as any)
 * Forbidden: mockReturnValue({}) with no type annotation when TS would infer `any`
 * Allowed: vi.fn<() => Promise<User>>().mockResolvedValue({ id: '1', name: 'Alice' })
 * Allowed: (mockFn as jest.MockedFunction<typeof realFn>).mockReturnValue(...)
 */

const MOCK_AS_ANY = /mockResolvedValue\s*\([^)]*\s+as\s+any\b/;
const MOCK_RETURN_AS_ANY = /mockReturnValue\s*\([^)]*\s+as\s+any\b/;
const JEST_FN_ANY = /jest\.fn\s*\(\s*\)\s*(?!<)/; // jest.fn() without generic type parameter

function findTestFiles(dir) {
  const files = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (['node_modules', 'dist', '.git'].includes(e.name)) continue;
        walk(join(d, e.name));
      } else if (e.name.match(/\.(test|spec)\.ts$/)) {
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
    return { pass: true, code: 'BT005', message: 'No TypeScript test files found — typed mock check skipped', skipped: true };
  }

  const violations = [];

  for (const file of testFiles) {
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      if (MOCK_AS_ANY.test(line) || MOCK_RETURN_AS_ANY.test(line)) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — mock return typed as any: ${line.trim().slice(0, 80)}`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'BT005',
      message: `${violations.length} mock(s) with any type found`,
      detail: violations.slice(0, 10).join('\n') + '\n\nUse typed mocks: vi.fn<() => Promise<MyType>>() or (mock as jest.MockedFunction<typeof fn>)'
    };
  }

  return { pass: true, code: 'BT005', message: `All mocks typed — no implicit any (${testFiles.length} file(s) checked)` };
}
