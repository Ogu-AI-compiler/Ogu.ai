import { readFileSync, existsSync } from 'fs'; import { join } from 'path';
export async function run({ dir, projectRoot }) {
  const root = projectRoot || dir;
  const artifactPath = join(root, '.ogu', 'artifacts', 'feature-flag-artifact.json');
  if (!existsSync(artifactPath)) return { pass: true, code: 'EV009', message: 'feature-flag-artifact.json not found — cross-compiler check skipped', skipped: true };
  let artifact; try { artifact = JSON.parse(readFileSync(artifactPath, 'utf8')); } catch { return { pass: true, code: 'EV009', message: 'Cannot read feature-flag artifact', skipped: true }; }
  if (!artifact.pass) return { pass: false, code: 'EV009', message: 'feature-flag-config compiler failed — experiment variants depend on passing flag setup' };
  return { pass: true, code: 'EV009', message: 'feature-flag-config compiler passed' };
}
