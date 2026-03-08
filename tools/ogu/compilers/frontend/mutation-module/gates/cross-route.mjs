import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'mutation-spec.json'), 'utf8'));
  const routeArtifactRef = spec.routeArtifact;

  if (!routeArtifactRef) {
    return { pass: true, code: 'MU011', message: 'No routeArtifact referenced — skipping cross-route check', skipped: true };
  }

  const artifactPath = resolve(dir, routeArtifactRef);
  if (!existsSync(artifactPath)) {
    return { pass: false, code: 'MU011', message: `route-artifact not found: ${artifactPath}` };
  }

  const routeArtifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
  const violations = [];

  // Method must match
  if (routeArtifact.method && spec.method) {
    if (routeArtifact.method.toUpperCase() !== spec.method.toUpperCase()) {
      violations.push(`Method mismatch: spec says "${spec.method}", route-artifact says "${routeArtifact.method}"`);
    }
  }

  // Endpoint must match
  if (routeArtifact.endpoint && spec.endpoint) {
    const specEp = spec.endpoint.replace(/^https?:\/\/[^/]+/, '');
    if (specEp !== routeArtifact.endpoint) {
      violations.push(`Endpoint mismatch: spec "${spec.endpoint}" vs route-artifact "${routeArtifact.endpoint}"`);
    }
  }

  // Payload fields must align with route's input_schema
  if (routeArtifact.input_schema?.required && spec.payloadFields) {
    const routeRequired = routeArtifact.input_schema.required;
    const payloadFields = spec.payloadFields;
    const missing = routeRequired.filter(f => !payloadFields.includes(f));
    if (missing.length) {
      violations.push(`Route requires fields not in mutation payload: ${missing.join(', ')}`);
    }
  }

  if (violations.length) {
    return { pass: false, code: 'MU011', message: 'Cross-route mismatch', detail: violations.join('\n') };
  }

  return { pass: true, code: 'MU011', message: 'Mutation payload and endpoint aligned with route-artifact' };
}
