import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * EC005 — errors-classified
 * Consumer errors must be classified: retryable (throw to retry) vs dead-letter (catch + DLQ).
 * Look for: dead letter / DLQ reference, or error classification pattern.
 */

const DEAD_LETTER_PATTERNS = [
  /dead.?letter|dlq|DeadLetter|deadLetter/i,
  /ack\s*\(\s*false\s*\)|nack\s*\(|reject\s*\(/i,
  /NonRetryable|UnrecoverableError|PermanentError/i,
  /move.*(?:dead|dlq)|sendToDlq|deadLetterQueue/i,
];

function collectFiles(dir) {
  const files = [];
  function walk(d) {
    let e; try { e = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of e) {
      if (f.isDirectory()) { if (!['node_modules','dist','.git','__tests__','tests'].includes(f.name)) walk(join(d,f.name)); }
      else if (f.name.match(/\.(ts|mjs|js)$/) && !f.name.match(/\.(test|spec|d)\./)) files.push(join(d,f.name));
    }
  }
  walk(dir);
  return files;
}

export async function run({ dir }) {
  const files = collectFiles(dir);
  const allContent = files.map(f => readFileSync(f, 'utf8')).join('\n');

  for (const pattern of DEAD_LETTER_PATTERNS) {
    if (pattern.test(allContent)) return { pass: true, code: 'EC005', message: `Error classification found (${files.length} file(s))` };
  }

  // Check if there are any try/catch blocks at all
  const hasTryCatch = /\btry\s*\{/.test(allContent);
  if (!hasTryCatch) {
    return { pass: false, code: 'EC005', message: 'No error handling found in consumer — add DLQ or error classification', detail: 'Add dead-letter queue routing for non-retryable errors' };
  }

  return { pass: true, code: 'EC005', message: 'Error handling present (try/catch) — DLQ classification recommended but not required', skipped: false };
}
