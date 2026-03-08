import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'guard-spec.json'), 'utf8'));
  if (!spec.authArtifact) return { pass: true, code: 'RG009', message: 'No authArtifact referenced — skipping', skipped: true };

  const path = resolve(dir, spec.authArtifact);
  if (!existsSync(path)) return { pass: false, code: 'RG009', message: `auth-artifact not found: ${path} — compile auth-middleware first` };

  const artifact = JSON.parse(readFileSync(path, 'utf8'));
  if (artifact.compiler !== 'auth-middleware') {
    return { pass: false, code: 'RG009', message: `Expected auth-middleware artifact, got: ${artifact.compiler}` };
  }

  // Guard's authHook must align with the auth strategy
  const files = require('fs').readdirSync(dir).filter(f => f.endsWith('.tsx') && !f.endsWith('.test.tsx'));
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  if (!content.includes(spec.authHook)) {
    return { pass: false, code: 'RG009', message: `Guard does not use specified authHook '${spec.authHook}'` };
  }

  return { pass: true, code: 'RG009', message: `Cross-auth valid — guard uses ${spec.authHook} (strategy: ${artifact.strategy})` };
}
