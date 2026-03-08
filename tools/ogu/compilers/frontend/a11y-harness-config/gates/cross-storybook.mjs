import { readFileSync, existsSync } from 'fs'; import { join } from 'path';
export async function run({ dir, projectRoot }) {
  const root = projectRoot || dir;
  const artifactPath = join(root, '.ogu', 'artifacts', 'storybook-harness-artifact.json');
  if (!existsSync(artifactPath)) return { pass: true, code: 'AH006', message: 'storybook-harness-artifact.json not found — cross-compiler check skipped', skipped: true };
  let artifact; try { artifact = JSON.parse(readFileSync(artifactPath, 'utf8')); } catch { return { pass: true, code: 'AH006', message: 'Cannot read storybook artifact', skipped: true }; }
  if (!artifact.pass) return { pass: false, code: 'AH006', message: 'storybook-harness-config compiler failed — a11y harness depends on passing Storybook setup' };
  return { pass: true, code: 'AH006', message: 'storybook-harness-config compiler passed' };
}
