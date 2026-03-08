import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * EC003 — envelope-validated-on-receipt
 * The event handler must validate the incoming envelope before processing.
 * Look for schema.parse/validate before accessing event.payload or event.data.
 */

const PAYLOAD_ACCESS = /(?:event|msg|message|envelope)\s*\.\s*(?:payload|data)\b/;
const SCHEMA_VALIDATE = /\.(?:parse|safeParse|validate)\s*\(/;

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
  let hasPayloadAccess = false;
  const violations = [];

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!PAYLOAD_ACCESS.test(lines[i])) continue;
      hasPayloadAccess = true;
      const prior = lines.slice(Math.max(0, i - 20), i).join('\n');
      if (!SCHEMA_VALIDATE.test(prior)) {
        violations.push(`${file.replace(dir+'/', '')}:${i+1} — event.payload accessed without schema validation`);
      }
    }
  }

  if (!hasPayloadAccess) return { pass: true, code: 'EC003', message: 'No event.payload access found — check skipped', skipped: true };
  if (violations.length) return { pass: false, code: 'EC003', message: `${violations.length} unvalidated payload access(es)`, detail: violations.slice(0,10).join('\n') };
  return { pass: true, code: 'EC003', message: `Envelope validated before payload access (${files.length} file(s))` };
}
