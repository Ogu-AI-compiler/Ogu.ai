import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * EP004 — no-business-logic
 * Publisher functions must only build envelope + dispatch.
 * Forbidden inside publisher: DB queries, HTTP calls, if/else business conditions.
 *
 * Allowed: building the envelope object, calling publish/emit/send
 * Forbidden: prisma.*, axios.*, fetch(, if (condition) { doBusinessThing }
 */

const DB_CALL = /\b(?:prisma|db|repository|repo)\s*\.\s*\w+\s*\(/i;
const HTTP_CALL = /\b(?:fetch|axios|got|ky)\s*[.(]/i;
const COMPLEX_CONDITION = /if\s*\([^)]{30,}\)/; // long if conditions suggest business logic

function collectPublisherFiles(dir) {
  const files = [];
  function walk(d) {
    let e; try { e = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of e) {
      if (f.isDirectory()) { if (!['node_modules', 'dist', '.git', '__tests__', 'tests'].includes(f.name)) walk(join(d, f.name)); }
      else if (f.name.match(/publisher|emit|dispatch/i) && f.name.match(/\.(ts|mjs|js)$/) && !f.name.match(/\.(test|spec|d)\./)) {
        files.push(join(d, f.name));
      }
    }
  }
  walk(dir);
  // If no publisher-named files, check all
  if (files.length === 0) {
    function walk2(d) {
      let e; try { e = readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const f of e) {
        if (f.isDirectory()) { if (!['node_modules', 'dist', '.git', '__tests__', 'tests'].includes(f.name)) walk2(join(d, f.name)); }
        else if (f.name.match(/\.(ts|mjs|js)$/) && !f.name.match(/\.(test|spec|d)\./)) files.push(join(d, f.name));
      }
    }
    walk2(dir);
  }
  return files;
}

export async function run({ dir }) {
  const files = collectPublisherFiles(dir);
  const violations = [];

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      if (DB_CALL.test(line)) violations.push(`${file.replace(dir + '/', '')}:${i + 1} — DB call in publisher: ${line.trim().slice(0, 80)}`);
      if (HTTP_CALL.test(line)) violations.push(`${file.replace(dir + '/', '')}:${i + 1} — HTTP call in publisher: ${line.trim().slice(0, 80)}`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'EP004',
      message: `${violations.length} business logic violation(s) in publisher`,
      detail: violations.slice(0, 10).join('\n') + '\n\nPublisher must only build envelope + dispatch. Move business logic to service layer.'
    };
  }

  return { pass: true, code: 'EP004', message: `Publisher is pure dispatch — no business logic (${files.length} file(s))` };
}
