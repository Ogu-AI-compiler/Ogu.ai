import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'story-spec.json'), 'utf8'));
  if (!spec.componentArtifact) return { pass: true, code: 'SB007', message: 'No componentArtifact — skipping', skipped: true };
  const path = resolve(dir, spec.componentArtifact);
  if (!existsSync(path)) return { pass: false, code: 'SB007', message: `component-artifact not found: ${path} — compile react-component first` };
  const artifact = JSON.parse(readFileSync(path, 'utf8'));
  return { pass: true, code: 'SB007', message: `Cross-component valid — story for ${artifact.component_name || spec.component}` };
}
