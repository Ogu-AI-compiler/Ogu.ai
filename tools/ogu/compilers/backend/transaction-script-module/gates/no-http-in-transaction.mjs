import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * TX003 — no-http-in-transaction
 * HTTP/network calls inside a DB transaction hold the transaction open, causing connection pool exhaustion.
 * Network calls must happen BEFORE (to gather data) or AFTER (to notify) the transaction.
 */

const TRANSACTION_MARKERS = ['$transaction', '.transaction(', 'knex.transaction', 'db.transaction'];
const HTTP_PATTERNS = [/\bfetch\s*\(/, /axios\./, /http\.request/, /https\.request/, /got\s*\(/, /superagent\./];

function getTxFiles(dir) {
  const results = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of entries) {
      if (f.isDirectory()) {
        if (!['node_modules', 'dist', '.git'].includes(f.name)) walk(join(d, f.name));
      } else if (f.name.match(/\.tx\.|transaction/) && f.name.endsWith('.ts') && !f.name.includes('.test.')) {
        results.push(join(d, f.name));
      }
    }
  }
  walk(dir);
  return results;
}

export async function run({ dir }) {
  const txFiles = getTxFiles(dir);
  if (txFiles.length === 0) {
    return { pass: true, code: 'TX003', message: 'No transaction files found — gate skipped', skipped: true };
  }

  const violations = [];

  for (const file of txFiles) {
    const content = readFileSync(file, 'utf8');

    // Find transaction callback content
    for (const marker of TRANSACTION_MARKERS) {
      const markerIdx = content.indexOf(marker);
      if (markerIdx === -1) continue;

      // Extract content from the transaction callback (roughly, between the callback braces)
      const afterMarker = content.slice(markerIdx);
      const callbackStart = afterMarker.indexOf('=>') !== -1 ? afterMarker.indexOf('=>') : afterMarker.indexOf('{');
      const callbackContent = afterMarker.slice(callbackStart, callbackStart + 1000); // approximate

      const lines = callbackContent.split('\n');
      lines.forEach((line, i) => {
        if (line.trim().startsWith('//')) return;
        if (HTTP_PATTERNS.some(p => p.test(line))) {
          violations.push(`${file.replace(dir+'/','')}: HTTP call inside transaction callback: ${line.trim().slice(0,80)}`);
        }
      });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'TX003',
      message: `${violations.length} HTTP call(s) inside transaction block`,
      detail: violations.join('\n') + '\n\nMove network calls outside the transaction: gather data before, notify after'
    };
  }

  return { pass: true, code: 'TX003', message: 'No HTTP calls inside transaction boundaries' };
}
