import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * SJ005 — errors-non-fatal
 * Job errors must be caught and logged — never propagate to crash the scheduler process.
 * The job body must be wrapped in try/catch. Uncaught throws from a cron handler crash node-cron.
 */

const JOB_HANDLER = /(?:scheduler|cron|agenda|schedule)\s*\.\s*(?:add|schedule|define|every|create|job)\s*\([^,]+,\s*(?:async\s*)?\(/i;
const HAS_TRY_CATCH = /\btry\s*\{[\s\S]*?\}\s*catch\s*\(/;

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
  let hasJobHandler = false;
  let hasTryCatch = false;

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    if (JOB_HANDLER.test(content) || content.includes('async (job)') || content.includes('async() =>')) hasJobHandler = true;
    if (HAS_TRY_CATCH.test(content)) hasTryCatch = true;
  }

  if (!hasJobHandler) return { pass: true, code: 'SJ005', message: 'No job handler detected — check skipped', skipped: true };

  if (!hasTryCatch) {
    return {
      pass: false, code: 'SJ005',
      message: 'Job handler has no try/catch — errors will crash scheduler',
      detail: 'Wrap job body:\ntry { await doWork(); } catch (err) { logger.error(err); // do NOT rethrow }'
    };
  }

  return { pass: true, code: 'SJ005', message: `Job errors caught — non-fatal (${files.length} file(s))` };
}
