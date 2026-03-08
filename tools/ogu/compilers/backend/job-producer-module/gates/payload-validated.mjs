import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * JP003 — payload-validated
 * The spec declares a payloadSchema. Before calling queue.add() / queue.createJob(),
 * the payload must be parsed/validated through that schema.
 *
 * Detection: the schema name from spec must appear before (within 20 lines of) the enqueue call.
 */

const ENQUEUE_CALL = /(?:queue|bull|boss)\s*\.\s*(?:add|createJob|send|publish)\s*\(/i;

function collectFiles(dir) {
  const files = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (['node_modules', 'dist', '.git', '__tests__', 'tests'].includes(e.name)) continue;
        walk(join(d, e.name));
      } else if (e.name.match(/\.(ts|mjs|js)$/) && !e.name.match(/\.(test|spec|d)\./)) {
        files.push(join(d, e.name));
      }
    }
  }
  walk(dir);
  return files;
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'job-producer-spec.json'), 'utf8'));
  const schemaName = spec.payloadSchema;
  const files = collectFiles(dir);
  const violations = [];
  let hasEnqueue = false;

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!ENQUEUE_CALL.test(lines[i])) continue;
      hasEnqueue = true;
      // Check prior 20 lines for schema validation call
      const window = lines.slice(Math.max(0, i - 20), i).join('\n');
      const schemaUsed = window.includes(schemaName) && (window.includes('.parse(') || window.includes('.validate(') || window.includes('.safeParse('));
      if (!schemaUsed) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — enqueue without "${schemaName}.parse/validate" in prior 20 lines`);
      }
    }
  }

  if (!hasEnqueue) {
    return { pass: false, code: 'JP003', message: 'No enqueue call found (queue.add, bull.add, boss.send)' };
  }

  if (violations.length) {
    return {
      pass: false, code: 'JP003',
      message: `${violations.length} enqueue call(s) without payload validation`,
      detail: violations.slice(0, 10).join('\n') + `\n\nCall ${schemaName}.parse(payload) before enqueue.`
    };
  }

  return {
    pass: true, code: 'JP003',
    message: `Payload validated with "${schemaName}" before all ${violations.length === 0 ? '' : ''}enqueue call(s)`
  };
}
