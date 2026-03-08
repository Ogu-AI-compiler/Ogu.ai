/**
 * Gate: hostnames-unique (DNS003)
 * Ensures no two DNS records share the same hostname. Duplicate hostnames create
 * ambiguous DNS entries — the provider may reject one, create a round-robin, or
 * silently overwrite the first entry depending on the record type.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec     = JSON.parse(readFileSync(join(dir, 'dns-config-spec.json'), 'utf8'));
  const seen     = new Set();
  const dupes    = [];

  for (const r of spec.records) {
    const key = `${r.hostname}/${r.type?.toUpperCase()}`;
    if (seen.has(key)) dupes.push({ hostname: r.hostname, type: r.type });
    seen.add(key);
  }

  if (dupes.length) {
    return {
      pass: false, code: 'DNS003',
      message: `Duplicate hostname/type combination(s): ${[...new Set(dupes.map(d => `${d.hostname} (${d.type})` ))].join(', ')}`,
      detail: {
        duplicates: dupes,
        hint: 'Each hostname+type combination must appear once. For multiple values (e.g. MX), use a single record with an array of targets.',
      },
    };
  }

  return { pass: true, code: 'DNS003', message: `All ${seen.size} hostname/type combinations are unique` };
}
