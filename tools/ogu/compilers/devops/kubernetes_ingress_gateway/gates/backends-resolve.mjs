/**
 * Gate: backends-resolve (KI002)
 * Cross-artifact gate: when a k8s-service-artifact.json exists, validates that the
 * Ingress backend service name matches the compiled Service. An Ingress that references
 * a non-existent Service results in 503 errors for all traffic on that rule.
 *
 * Falls back gracefully when no service artifact exists (service not yet compiled).
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

function collectBackends(spec) {
  const backends = [];
  for (const rule of spec.rules) {
    for (const path of (rule.paths || [])) {
      if (path.backend?.service) backends.push({ service: path.backend.service, port: path.backend.port, path: path.path });
    }
    if (rule.backend?.service) backends.push({ service: rule.backend.service, port: rule.backend.port });
  }
  return backends;
}

export async function run({ dir }) {
  const spec     = JSON.parse(readFileSync(join(dir, 'k8s-ingress-spec.json'), 'utf8'));
  const backends = collectBackends(spec);

  // Multi-path artifact resolution — service may be compiled in a sibling directory
  const candidates = [
    join(dir, 'k8s-service-artifact.json'),
    join(dirname(dir), 'k8s-service-artifact.json'),
    join(dirname(dir), 'kubernetes_service', 'k8s-service-artifact.json'),
  ];
  const artifactPath = candidates.find(p => existsSync(p));

  if (!artifactPath) {
    if (backends.length === 0) return { pass: true, code: 'KI002', message: 'No backends — skipped', skipped: true };
    return {
      pass: true, code: 'KI002',
      message: `${backends.length} backend(s) declared (no service artifact to cross-validate against)`,
      skipped: true,
    };
  }

  const svc        = JSON.parse(readFileSync(artifactPath, 'utf8'));
  const violations = [];

  for (const backend of backends) {
    if (backend.service !== svc.name) {
      violations.push({
        backend:  backend.service,
        expected: svc.name,
        reason:   `backend service "${backend.service}" does not match compiled service "${svc.name}"`,
        hint:     `Update the backend service name to "${svc.name}"`,
      });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'KI002',
      message: `${violations.length} unresolved backend(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'KI002', message: `All ${backends.length} backend(s) resolve to compiled service "${svc.name}"` };
}
