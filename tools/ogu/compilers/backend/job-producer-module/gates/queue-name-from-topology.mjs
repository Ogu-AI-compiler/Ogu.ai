import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * JP004 — queue-name-from-topology
 * The queue name must not appear as a bare string literal in code.
 * It must come from a named constant (UPPER_CASE), an import, or config.
 *
 * ALLOWED:   new Queue(QUEUES.EMAIL_SEND)
 * ALLOWED:   new Queue(config.queues.emailSend)
 * ALLOWED:   new Queue(QUEUE_NAMES.EMAIL_SEND)
 * FORBIDDEN: new Queue('email-send')
 * FORBIDDEN: queue.add('email-send', payload)
 */

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
  const queueName = spec.queueName;
  const files = collectFiles(dir);
  const violations = [];

  // Queue name as string literal: 'queue-name' or "queue-name"
  const LITERAL_QUEUE = new RegExp(`['"\`]${queueName.replace(/-/g, '[-_]')}['"\`]`, 'i');

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      // Allow in spec/config files; only check source files
      if (LITERAL_QUEUE.test(line) && !line.includes('//')) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — queue name "${queueName}" as string literal`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'JP004',
      message: `${violations.length} hardcoded queue name(s) found`,
      detail: violations.slice(0, 10).join('\n') + `\n\nUse: import { QUEUES } from '@/queue-topology'; then new Queue(QUEUES.${queueName.toUpperCase().replace(/-/g, '_')})`
    };
  }

  return { pass: true, code: 'JP004', message: `Queue name not hardcoded — comes from topology constant (${files.length} file(s) checked)` };
}
