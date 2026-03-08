import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * SS002 — upsert-only
 * Seeds must use upsert/createOrUpdate, not bare insert/create.
 * Bare inserts fail on re-run (duplicate key).
 *
 * ALLOWED: prisma.user.upsert(), createOrUpdate(), insertOrIgnore()
 * FORBIDDEN: prisma.user.create(), db.insert(), INSERT INTO without ON CONFLICT
 */

const BARE_INSERT = /(?:prisma\.\w+\.create\s*\(|\.create\s*\(\s*\{\s*data\s*:|db\.insert\s*\(|\.insert\s*\(\s*\[|INSERT\s+INTO\s+(?!.*ON\s+CONFLICT))/i;
const UPSERT = /\.upsert\s*\(|\.createOrUpdate|insertOrIgnore|ON\s+CONFLICT|createMany.*skipDuplicates/i;
const ESCAPE = /@bare-insert-ok/;

function collectFiles(dir) {
  const files = [];
  function walk(d) {
    let e; try { e = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of e) {
      if (f.isDirectory()) { if (!['node_modules','dist','.git','__tests__','tests'].includes(f.name)) walk(join(d,f.name)); }
      else if (f.name.match(/seed|fixture/i) && f.name.match(/\.(ts|mjs|js)$/) && !f.name.match(/\.(test|spec|d)\./)) files.push(join(d,f.name));
    }
  }
  walk(dir);
  if (files.length === 0) {
    function walk2(d) {
      let e; try { e = readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const f of e) {
        if (f.isDirectory()) { if (!['node_modules','dist','.git','__tests__','tests'].includes(f.name)) walk2(join(d,f.name)); }
        else if (f.name.match(/\.(ts|mjs|js)$/) && !f.name.match(/\.(test|spec|d)\./)) files.push(join(d,f.name));
      }
    }
    walk2(dir);
  }
  return files;
}

export async function run({ dir }) {
  const files = collectFiles(dir);
  const violations = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    if (!UPSERT.test(content) && BARE_INSERT.test(content)) {
      // Check line by line for bare inserts without upsert
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (BARE_INSERT.test(lines[i]) && !ESCAPE.test(lines[i])) {
          violations.push(`${file.replace(dir+'/', '')}:${i+1} — bare insert without upsert: ${lines[i].trim().slice(0,80)}`);
        }
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'SS002',
      message: `${violations.length} bare insert(s) found — seeds must be idempotent`,
      detail: violations.slice(0,10).join('\n') + '\n\nUse: prisma.user.upsert({ where: { id }, update: {}, create: {...} })'
    };
  }

  return { pass: true, code: 'SS002', message: `All seed operations use upsert/idempotent patterns (${files.length} file(s))` };
}
