/**
 * Gate: ports-match-spec (DF008)
 * Verifies that every port declared in dockerfile-spec.json is also EXPOSEd in the
 * Dockerfile. An unexposed port that is listed in the spec is a drift — the container
 * will not publish traffic on that port at runtime without an explicit mapping.
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

function findDockerfile(dir) {
  const candidates = ['Dockerfile', 'dockerfile', 'Dockerfile.prod', 'Dockerfile.production'];
  for (const name of candidates) {
    const p = join(dir, name);
    if (existsSync(p)) return p;
  }
  try {
    const df = readdirSync(dir).find(e => e.toLowerCase().startsWith('dockerfile'));
    if (df) return join(dir, df);
  } catch { /* unreadable */ }
  return null;
}

export async function run({ dir }) {
  const specPath = join(dir, 'dockerfile-spec.json');
  if (!existsSync(specPath)) return { pass: true, code: 'DF008', message: 'No spec — skipped', skipped: true };

  const spec      = JSON.parse(readFileSync(specPath, 'utf8'));
  const specPorts = (spec.ports || []).map(Number);
  if (specPorts.length === 0) {
    return { pass: true, code: 'DF008', message: 'No ports declared in spec — skipped', skipped: true };
  }

  const dfPath = findDockerfile(dir);
  if (!dfPath) return { pass: true, code: 'DF008', message: 'No Dockerfile — skipped', skipped: true };

  const lines = readFileSync(dfPath, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => !l.startsWith('#'));

  const exposedPorts = lines
    .filter(l => /^EXPOSE\s/i.test(l))
    .flatMap(l => l.replace(/^EXPOSE\s+/i, '').split(/\s+/).map(p => Number(p.split('/')[0])));

  if (exposedPorts.length === 0) {
    return {
      pass: false, code: 'DF008',
      message: `Spec declares ports [${specPorts.join(', ')}] but no EXPOSE instruction found`,
      detail: {
        specPorts,
        hint: `Add EXPOSE ${specPorts.join(' ')} to the Dockerfile`,
      },
    };
  }

  const missing = specPorts.filter(p => !exposedPorts.includes(p));
  if (missing.length) {
    return {
      pass: false, code: 'DF008',
      message: `Ports in spec not exposed in Dockerfile: ${missing.join(', ')}`,
      detail: {
        specPorts,
        exposedPorts,
        missing,
        hint: `Add: EXPOSE ${missing.join(' ')}`,
      },
    };
  }

  return {
    pass: true, code: 'DF008',
    message: `Exposed ports match spec: [${specPorts.join(', ')}]`,
  };
}
