import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * WH005 — async-handoff
 * Business logic must be offloaded to a queue/background worker.
 * The HTTP handler should only: verify signature, ack, enqueue.
 *
 * Check for queue.add, setImmediate, setTimeout, eventBus.publish, bull, etc.
 * inside webhook handler.
 */

const ASYNC_HANDOFF_PATTERNS = [
  /queue\s*\.\s*add\s*\(/i,
  /setImmediate\s*\(/,
  /setTimeout\s*\(/,
  /eventBus\s*\.\s*(?:publish|emit)\s*\(/i,
  /bull|bullmq|pg-boss|agenda/i,
  /producer\s*\.\s*(?:add|send|publish)/i,
  /process\.nextTick\s*\(/,
  /worker\s*\.postMessage/i,
];

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
  const allContent = files.map(f => readFileSync(f, 'utf8')).join('\n');

  for (const pattern of ASYNC_HANDOFF_PATTERNS) {
    if (pattern.test(allContent)) {
      return { pass: true, code: 'WH005', message: `Async handoff pattern found (${files.length} file(s))` };
    }
  }

  return {
    pass: false, code: 'WH005',
    message: 'No async handoff found — business logic appears to execute synchronously in HTTP handler',
    detail: 'Enqueue to BullMQ/pg-boss or publish to event bus after ack:\nawait queue.add("process-webhook", { payload });\nres.sendStatus(200);'
  };
}
