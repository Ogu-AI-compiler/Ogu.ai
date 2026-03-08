import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

export async function run({ dir, projectRoot }) {
  const spec = JSON.parse(readFileSync(join(dir, 'query-spec.json'), 'utf8'));
  const routeArtifactRef = spec.routeArtifact; // e.g., "../user-route/route-artifact.json"

  if (!routeArtifactRef) {
    return { pass: true, code: 'QM011', message: 'No routeArtifact referenced — skipping cross-route check', skipped: true };
  }

  const artifactPath = resolve(dir, routeArtifactRef);
  if (!existsSync(artifactPath)) {
    return { pass: false, code: 'QM011', message: `route-artifact not found: ${artifactPath}` };
  }

  let routeArtifact;
  try {
    routeArtifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'QM011', message: `Invalid route-artifact JSON: ${e.message}` };
  }

  const violations = [];

  // Check endpoint matches
  if (routeArtifact.endpoint && spec.endpoint) {
    const specEndpoint = spec.endpoint.replace(/^https?:\/\/[^/]+/, '');
    const routeEndpoint = routeArtifact.endpoint;
    if (specEndpoint !== routeEndpoint && !routeEndpoint.includes(specEndpoint)) {
      violations.push(`Endpoint mismatch: spec says "${spec.endpoint}", route-artifact says "${routeArtifact.endpoint}"`);
    }
  }

  // Check response type alignment
  if (routeArtifact.output_schema && spec.responseType) {
    const outputFields = Object.keys(routeArtifact.output_schema?.properties || {});
    const responseType = spec.responseType;

    // If responseType is a string type name, check that route artifact has corresponding schema
    if (outputFields.length && !outputFields.some(f => responseType.toLowerCase().includes(f.toLowerCase()))) {
      // Check hook file for type usage
      const hookFiles = readdirSync(dir).filter(f => f.startsWith('use') && (f.endsWith('.ts') || f.endsWith('.tsx')));
      if (hookFiles.length) {
        const hookContent = readFileSync(join(dir, hookFiles[0]), 'utf8');
        const missingFields = outputFields.filter(field => !hookContent.includes(field));
        if (missingFields.length > outputFields.length / 2) {
          violations.push(`Response type in hook doesn't align with route output_schema fields: ${missingFields.slice(0, 3).join(', ')}`);
        }
      }
    }
  }

  // Check method matches
  if (routeArtifact.method && spec.method) {
    if (routeArtifact.method.toUpperCase() !== spec.method.toUpperCase()) {
      violations.push(`Method mismatch: spec says "${spec.method}", route-artifact says "${routeArtifact.method}"`);
    }
  }

  if (violations.length) {
    return { pass: false, code: 'QM011', message: 'Cross-route mismatch', detail: violations.join('\n') };
  }

  return {
    pass: true, code: 'QM011',
    message: `Cross-route valid — endpoint and response type aligned with route-artifact`
  };
}
