import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * SJ003 — stable-registration-id
 * The job registration ID must be a stable constant, not generated dynamically.
 * Forbidden: Date.now(), Math.random(), uuid(), new Date() in the job ID.
 */

const DYNAMIC_ID = /(?:Date\.now\(\)|Math\.random\(\)|uuid\(\)|new Date\(\)|nanoid\(\)|crypto\.randomUUID\(\))/;
const JOB_REGISTRATION = /(?:scheduler|cron|agenda|node-schedule|bull)\s*\.\s*(?:add|schedule|define|every|create)\s*\(/i;

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
  const violations = [];

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//')) continue;
      if (JOB_REGISTRATION.test(line) || (i > 0 && JOB_REGISTRATION.test(lines[i-1]))) {
        // Check within 5 lines for dynamic ID
        const window = lines.slice(Math.max(0, i-1), i+5).join('\n');
        if (DYNAMIC_ID.test(window)) {
          violations.push(`${file.replace(dir+'/', '')}:${i+1} — dynamic job ID near registration call`);
        }
      }
    }
  }

  if (violations.length) return { pass: false, code: 'SJ003', message: `${violations.length} dynamic job ID(s) detected`, detail: violations.join('\n') };
  return { pass: true, code: 'SJ003', message: `No dynamic job registration IDs (${files.length} file(s))` };
}
