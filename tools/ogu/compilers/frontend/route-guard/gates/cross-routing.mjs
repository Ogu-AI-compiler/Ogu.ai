import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'guard-spec.json'), 'utf8'));
  if (!spec.routingArtifact) return { pass: true, code: 'RG010', message: 'No routingArtifact referenced — skipping', skipped: true };

  const path = resolve(dir, spec.routingArtifact);
  if (!existsSync(path)) return { pass: false, code: 'RG010', message: `routing-artifact not found: ${path} — compile routing-config first` };

  const routingArtifact = JSON.parse(readFileSync(path, 'utf8'));

  // redirectTo must be a known route
  const knownPaths = (routingArtifact.routes || []).map(r => r.path);
  if (knownPaths.length && !knownPaths.includes(spec.redirectTo)) {
    return { pass: false, code: 'RG010', message: `redirectTo '${spec.redirectTo}' is not a registered route in routing-artifact`, detail: `Known routes: ${knownPaths.join(', ')}` };
  }

  return { pass: true, code: 'RG010', message: `redirectTo '${spec.redirectTo}' is a valid registered route` };
}
