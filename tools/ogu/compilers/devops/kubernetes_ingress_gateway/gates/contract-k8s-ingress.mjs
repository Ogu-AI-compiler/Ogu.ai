/**
 * Gate: contract-k8s-ingress (KI007)
 * Enforces the kubernetes_ingress_gateway runtime contract: public-facing ingresses
 * must have TLS configured (serving HTTP without HTTPS is a security antipattern),
 * and the ingressClass must be specified to prevent multiple ingress controllers from
 * fighting over the same resource.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'k8s-ingress-spec.json'), 'utf8'));
  const violations = [];

  const hasPublicHosts = spec.rules.some(r => r.host);
  if (!spec.tls && hasPublicHosts && !spec.skipTlsCheck) {
    violations.push({
      rule:   'tls-required-for-public-hosts',
      reason: 'Public-facing ingress has no TLS configuration — serving HTTP without HTTPS exposes traffic to interception',
      hint:   'Add tls: [{ hosts: ["my.example.com"], secretName: "my-tls-cert" }] or set skipTlsCheck: true for internal-only routes',
    });
  }

  if (!spec.ingressClass && !spec.annotations?.['kubernetes.io/ingress.class']) {
    violations.push({
      rule:   'ingress-class-required',
      reason: 'No ingressClass specified — if multiple ingress controllers are present, they will all attempt to manage this resource',
      hint:   'Add ingressClass: "nginx" (or "traefik", "haproxy", etc.) or the annotation kubernetes.io/ingress.class',
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'KI007',
      message: `${violations.length} contract violation(s)`,
      detail: { violations },
    };
  }

  return {
    pass: true, code: 'KI007',
    message: `Ingress/Gateway contract satisfied — "${spec.name}"`,
  };
}
