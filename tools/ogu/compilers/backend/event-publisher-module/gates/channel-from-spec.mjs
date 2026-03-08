import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * EP003 — channel-from-spec
 * Channel/topic name must not appear as a bare string literal.
 * Must be imported from a constants file or come from config.
 */

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
  const spec = JSON.parse(readFileSync(join(dir, 'event-publisher-spec.json'), 'utf8'));
  const channel = spec.channel;
  const files = collectFiles(dir);
  const violations = [];

  const LITERAL_CHANNEL = new RegExp(`['"\`]${channel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`);

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      // Allow in constant definition files (channels.ts, topics.ts, events.ts)
      const isConstantFile = file.includes('channel') || file.includes('topic') || file.includes('events') || file.includes('const');
      if (LITERAL_CHANNEL.test(line) && !isConstantFile) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — channel "${channel}" as string literal`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'EP003',
      message: `${violations.length} hardcoded channel name(s)`,
      detail: violations.slice(0, 10).join('\n') + `\n\nImport channel from constants: import { CHANNELS } from './channels';`
    };
  }

  return { pass: true, code: 'EP003', message: `Channel "${channel}" not hardcoded in publisher files` };
}
