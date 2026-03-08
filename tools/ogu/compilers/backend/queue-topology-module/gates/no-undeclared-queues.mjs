import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * QT005 — no-undeclared-queues
 * Queue name strings must not appear as literals outside the queue topology module.
 * Producers and workers must import queue names from the topology module, never hardcode them.
 *
 * BAD:  new Queue('email-notifications', ...)  // in a service file
 * GOOD: import { QUEUES } from '../../lib/queues'; new Queue(QUEUES.EMAIL_NOTIFICATIONS, ...)
 */

const QUEUE_MODULE_PATHS = ['src/lib/queues', 'lib/queues', 'src/queues'];

function isQueueModuleFile(filePath, dir) {
  return QUEUE_MODULE_PATHS.some(p => filePath.includes(join(dir, p)));
}

function getAllTsFiles(dir) {
  const results = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (['node_modules', 'dist', '.ogu', '.git', 'coverage'].includes(e.name)) continue;
        walk(join(d, e.name));
      } else if (e.name.endsWith('.ts') && !e.name.includes('.d.ts')) {
        results.push(join(d, e.name));
      }
    }
  }
  walk(dir);
  return results;
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'queue-topology-spec.json'), 'utf8'));
  const declaredNames = spec.queues.map(q => q.name);

  if (declaredNames.length === 0) {
    return { pass: true, code: 'QT005', message: 'No queues declared — gate skipped', skipped: true };
  }

  // Build regex that matches any declared queue name as a string literal outside queue module
  const namePattern = new RegExp(`['"\`](${declaredNames.map(n => n.replace(/[-]/g, '\\-')).join('|')})['"\`]`);

  const allFiles = getAllTsFiles(dir);
  const violations = [];

  for (const file of allFiles) {
    if (isQueueModuleFile(file, dir)) continue; // topology module itself is allowed
    if (file.includes('.test.') || file.includes('.spec.')) continue; // tests may reference names in assertions

    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, i) => {
      if (namePattern.test(line) && !line.trim().startsWith('//')) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — hardcoded queue name: ${line.trim().slice(0, 80)}`);
      }
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'QT005',
      message: `${violations.length} hardcoded queue name(s) found outside topology module`,
      detail: violations.join('\n') + '\n\nFix: import { QUEUES } from "../../lib/queues" and use QUEUES.MY_QUEUE'
    };
  }

  return { pass: true, code: 'QT005', message: 'No undeclared queue literals found outside topology module' };
}
