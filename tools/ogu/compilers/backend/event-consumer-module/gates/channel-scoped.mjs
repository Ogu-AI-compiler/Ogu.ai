import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * EC006 — channel-scoped
 * Consumer only subscribes to channels declared in spec.channels.
 * Detect subscribe/on calls with string literals not in spec.
 */

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

const SUBSCRIBE_CALL = /\.(?:subscribe|on|listen|consume)\s*\(\s*['"`]([^'"`]+)['"`]/;

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'event-consumer-spec.json'), 'utf8'));
  const allowedChannels = new Set(spec.channels);
  const files = collectFiles(dir);
  const violations = [];

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//')) continue;
      const m = SUBSCRIBE_CALL.exec(line);
      if (!m) continue;
      const channel = m[1];
      if (!allowedChannels.has(channel)) {
        violations.push(`${file.replace(dir+'/', '')}:${i+1} — subscription to undeclared channel "${channel}"`);
      }
    }
  }

  if (violations.length) return { pass: false, code: 'EC006', message: `${violations.length} undeclared channel subscription(s)`, detail: violations.join('\n') };
  return { pass: true, code: 'EC006', message: `All subscriptions within declared channels: [${[...allowedChannels].join(', ')}]` };
}
