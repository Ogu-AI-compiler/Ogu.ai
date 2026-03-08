import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'queue-topology-spec.json'), 'utf8'));
  const names = spec.queues.map(q => q.name);
  const seen = new Set();
  const duplicates = [];

  for (const name of names) {
    if (seen.has(name)) duplicates.push(name);
    seen.add(name);
  }

  if (duplicates.length) {
    return {
      pass: false, code: 'QT002',
      message: `Duplicate queue name(s): ${duplicates.join(', ')}`,
      detail: 'Every queue must have a unique name. Queues are global — duplicates cause silent job routing bugs.'
    };
  }

  return { pass: true, code: 'QT002', message: `All ${names.length} queue names are unique` };
}
