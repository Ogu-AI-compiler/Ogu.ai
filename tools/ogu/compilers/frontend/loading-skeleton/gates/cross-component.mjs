import { readFileSync, existsSync, resolve } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'skeleton-spec.json'), 'utf8'));
  const componentArtifactRef = spec.componentArtifact;

  if (!componentArtifactRef) {
    return { pass: true, code: 'SK010', message: 'No componentArtifact referenced — skipping cross-component check', skipped: true };
  }

  const artifactPath = resolve(dir, componentArtifactRef);
  if (!existsSync(artifactPath)) {
    return { pass: false, code: 'SK010', message: `component-artifact not found: ${artifactPath} — compile react-component first` };
  }

  const componentArtifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
  const componentName = componentArtifact.component_name || componentArtifact.name;

  // Check skeleton is named after the component
  if (componentName && spec.componentName !== componentName) {
    return {
      pass: false, code: 'SK010',
      message: `Skeleton component name mismatch: spec says '${spec.componentName}', artifact says '${componentName}'`
    };
  }

  return { pass: true, code: 'SK010', message: `Cross-component valid — skeleton matches ${componentName}` };
}
