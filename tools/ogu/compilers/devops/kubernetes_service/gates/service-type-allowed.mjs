/**
 * Gate: service-type-allowed (KS005)
 * Validates that the Service type is in the org-allowed set. LoadBalancer and NodePort
 * types expose ports externally and have security implications — they require explicit
 * approval at the spec level to prevent accidental public exposure.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const DEFAULT_ALLOWED_TYPES = ['ClusterIP', 'NodePort', 'LoadBalancer', 'ExternalName', 'Headless'];

/** Service types with non-obvious security or operational implications */
const RESTRICTED_TYPE_WARNINGS = {
  LoadBalancer: 'exposes the service externally — ensure cloud security group/firewall rules are set',
  NodePort:     'exposes a port on every cluster node — prefer LoadBalancer + Ingress for external traffic',
  ExternalName: 'routes traffic to an external DNS name — verify the target is intentional',
};

export async function run({ dir }) {
  const spec        = JSON.parse(readFileSync(join(dir, 'k8s-service-spec.json'), 'utf8'));
  const serviceType = spec.type || 'ClusterIP';
  const allowed     = spec.allowedServiceTypes || DEFAULT_ALLOWED_TYPES;

  if (!allowed.includes(serviceType)) {
    return {
      pass: false, code: 'KS005',
      message: `Service type "${serviceType}" is not in the allowed set`,
      detail: {
        type:    serviceType,
        allowed,
        hint:    'Use ClusterIP for internal services. For external access, use LoadBalancer or an Ingress.',
      },
    };
  }

  const warning = RESTRICTED_TYPE_WARNINGS[serviceType];
  return {
    pass: true, code: 'KS005',
    message: `Service type "${serviceType}" is allowed${warning ? ` (note: ${warning})` : ''}`,
  };
}
