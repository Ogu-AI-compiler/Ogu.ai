import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const PUBLISH_CALL = /(?:\.publish|\.emit|\.send|\.dispatch)\s*\(/i;
const HAS_AWAIT = /\bawait\b/;

function collectFiles(dir) {
  const files = [];
  function walk(d) {
    let e; try { e = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of e) {
      if (f.isDirectory()) { if (!['node_modules', 'dist', '.git', '__tests__', 'tests'].includes(f.name)) walk(join(d, f.name)); }
      else if (f.name.match(/\.(ts|mjs|js)$/) && !f.name.match(/\.(test|spec|d)\./)) files.push(join(d, f.name));
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
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      if (PUBLISH_CALL.test(line) && !HAS_AWAIT.test(line)) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — publish not awaited: ${line.trim().slice(0, 80)}`);
      }
    }
  }

  if (violations.length) {
    return { pass: false, code: 'EP005', message: `${violations.length} unawaited publish call(s)`, detail: violations.slice(0, 10).join('\n') };
  }
  return { pass: true, code: 'EP005', message: `All publish calls awaited (${files.length} file(s))` };
}
