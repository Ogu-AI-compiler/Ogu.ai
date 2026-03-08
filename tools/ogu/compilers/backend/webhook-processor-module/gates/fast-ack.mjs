import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * WH004 — fast-ack
 * HTTP 200/202 must be sent before async processing.
 * Pattern: res.sendStatus(200) or res.status(200).json() before await of business logic.
 *
 * Detection: look for res.sendStatus/res.status inside webhook handler BEFORE any await of service calls.
 */

const RES_ACK = /res\s*\.\s*(?:sendStatus|status)\s*\(\s*(?:200|202)/;
const AWAIT_BUSINESS = /await\s+\w+(?:Service|Handler|Process|Handle|Execute)\s*\./i;

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
  let hasAck = false;
  let ackBeforeBusiness = false;

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    if (!RES_ACK.test(content)) continue;
    hasAck = true;

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!RES_ACK.test(lines[i])) continue;
      // Check if business logic comes AFTER the ack in the handler
      const after = lines.slice(i + 1, i + 30).join('\n');
      if (AWAIT_BUSINESS.test(after) || /setImmediate|setTimeout|queue\.add|enqueue/.test(after)) {
        ackBeforeBusiness = true;
      }
    }
  }

  if (!hasAck) {
    return {
      pass: false, code: 'WH004',
      message: 'No immediate HTTP 200/202 response found in webhook handler',
      detail: 'Send res.sendStatus(200) immediately, then hand off to queue or background process'
    };
  }

  return { pass: true, code: 'WH004', message: `Fast ack (200/202) found — ${ackBeforeBusiness ? 'before async processing' : 'response present'} (${files.length} file(s))` };
}
