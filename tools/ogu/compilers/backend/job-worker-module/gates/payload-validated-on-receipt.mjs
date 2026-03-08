import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * JW003 — payload-validated-on-receipt
 * Job processor function must validate job.data before using it.
 * The payloadSchema from spec must appear before any business logic use of job.data.
 */

const PROCESSOR_FN = /(?:Worker|worker|processor)\s*(?:=|new Worker\s*\(|\.process\s*\()/;
const JOB_DATA_USE = /job\.data\./;

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
  const spec = JSON.parse(readFileSync(join(dir, 'job-worker-spec.json'), 'utf8'));
  const schemaName = spec.payloadSchema;
  const files = collectFiles(dir);
  let hasProcessor = false;
  const violations = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    if (!PROCESSOR_FN.test(content) && !content.includes('async (job)') && !content.includes('async(job)')) continue;
    hasProcessor = true;

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!JOB_DATA_USE.test(lines[i])) continue;
      // Check prior 30 lines for schema validation
      const prior = lines.slice(Math.max(0, i - 30), i).join('\n');
      const validated = prior.includes(schemaName) && (prior.includes('.parse(') || prior.includes('.safeParse(') || prior.includes('.validate('));
      if (!validated) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — job.data used without "${schemaName}" validation`);
      }
    }
  }

  if (!hasProcessor) return { pass: false, code: 'JW003', message: 'No job processor function found' };
  if (violations.length) return { pass: false, code: 'JW003', message: `${violations.length} unvalidated job.data access(es)`, detail: violations.slice(0, 10).join('\n') };

  return { pass: true, code: 'JW003', message: `Payload validated with "${schemaName}" on receipt` };
}
