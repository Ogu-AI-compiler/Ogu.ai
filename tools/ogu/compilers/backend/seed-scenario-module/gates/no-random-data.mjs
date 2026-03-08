import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * SS003 — no-random-data
 * Seeds must be deterministic. Random data (Math.random, uuid, faker) makes
 * seeds non-reproducible, breaking test expectations.
 *
 * If spec.allowRandom: true, skip.
 * The escape hatch: // @random-seed-ok: reason
 */

const RANDOM_PATTERNS = /Math\.random\(\)|crypto\.randomUUID\(\)|nanoid\(\)|faker\.\w+\.\w+\(\)|uuidv4\(\)|uuid\(\)/;
const ESCAPE = /@random-seed-ok/;

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
  const spec = JSON.parse(readFileSync(join(dir, 'seed-scenario-spec.json'), 'utf8'));
  if (spec.allowRandom === true) return { pass: true, code: 'SS003', message: 'spec.allowRandom=true — random data check skipped', skipped: true };

  const files = collectFiles(dir);
  const violations = [];

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//') || ESCAPE.test(line)) continue;
      if (RANDOM_PATTERNS.test(line)) violations.push(`${file.replace(dir+'/', '')}:${i+1} — random data in seed: ${line.trim().slice(0,80)}`);
    }
  }

  if (violations.length) return { pass: false, code: 'SS003', message: `${violations.length} random value(s) in seed`, detail: violations.slice(0,10).join('\n') + '\n\nUse fixed values: id: "seed-user-1". Add // @random-seed-ok if intentional.' };
  return { pass: true, code: 'SS003', message: `No random data — seeds are deterministic (${files.length} file(s))` };
}
