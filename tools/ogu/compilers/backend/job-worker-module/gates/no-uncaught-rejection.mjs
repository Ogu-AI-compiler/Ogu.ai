import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * JW006 — no-uncaught-rejection
 * The processor function (async (job) => { ... }) must have a try/catch
 * or be a properly structured async function that lets BullMQ catch errors.
 *
 * Forbidden: fire-and-forget promises inside the processor without await or .catch()
 *   doSomethingAsync(); // not awaited, rejection silently ignored
 *
 * Allowed:
 *   await doSomethingAsync();
 *   doSomethingAsync().catch(err => { ... });
 */

const UNAWAITED_ASYNC = /^(?!\s*(?:await|return|const\s+\w+\s*=\s*await|let\s+\w+\s*=\s*await|throw))\s*\w[\w.]*\s*\([^)]*\)\s*;/;
const ASYNC_FN_CALL = /\w[\w.]*Async\s*\(|send\s*\(|emit\s*\(|publish\s*\(|enqueue\s*\(/;

function collectFiles(dir) {
  const files = [];
  function walk(d) {
    let entries; try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) { if (!['node_modules', 'dist', '.git', '__tests__', 'tests'].includes(e.name)) walk(join(d, e.name)); }
      else if (e.name.match(/\.(ts|mjs|js)$/) && !e.name.match(/\.(test|spec|d)\./)) files.push(join(d, e.name));
    }
  }
  walk(dir);
  return files;
}

export async function run({ dir }) {
  const files = collectFiles(dir);
  const violations = [];

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    let inProcessor = false;
    let processorDepth = 0;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/async\s*\(\s*job\s*\)/.test(line) || /async\s+function\s+process/.test(line)) {
        inProcessor = true;
        processorDepth = braceDepth;
      }
      braceDepth += (line.match(/\{/g) || []).length;
      braceDepth -= (line.match(/\}/g) || []).length;
      if (inProcessor && braceDepth <= processorDepth) inProcessor = false;

      if (inProcessor && ASYNC_FN_CALL.test(line) && !/\bawait\b/.test(line) && !/.catch\(/.test(line) && !line.trim().startsWith('//')) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — possibly unawaited async call in processor: ${line.trim().slice(0, 80)}`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'JW006',
      message: `${violations.length} potentially unawaited async call(s) in processor`,
      detail: violations.slice(0, 10).join('\n') + '\n\nAwait all async operations inside the processor to ensure failures surface to BullMQ.'
    };
  }

  return { pass: true, code: 'JW006', message: `No uncaught async calls in processor (${files.length} file(s) checked)` };
}
