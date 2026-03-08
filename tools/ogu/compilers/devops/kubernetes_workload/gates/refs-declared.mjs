/**
 * Gate: refs-declared (KW005)
 * Validates that every ConfigMap and Secret referenced via envFrom or volume mounts
 * is explicitly declared in spec.declaredRefs. Undeclared references fail silently
 * at pod scheduling time — the kubelet can't find the resource and puts the pod in
 * CrashLoopBackOff with a cryptic error.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec        = JSON.parse(readFileSync(join(dir, 'k8s-workload-spec.json'), 'utf8'));
  const declaredSet = new Set((spec.declaredRefs || []).map(r => `${r.kind}/${r.name}`));
  const violations  = [];

  for (const ref of (spec.envFrom || [])) {
    if (ref.configMapRef && !declaredSet.has(`ConfigMap/${ref.configMapRef.name}`) && !spec.allowUndeclaredRefs) {
      violations.push({
        kind: 'ConfigMap', name: ref.configMapRef.name,
        source: 'envFrom', reason: 'not declared in spec.declaredRefs',
      });
    }
    if (ref.secretRef && !declaredSet.has(`Secret/${ref.secretRef.name}`) && !spec.allowUndeclaredRefs) {
      violations.push({
        kind: 'Secret', name: ref.secretRef.name,
        source: 'envFrom', reason: 'not declared in spec.declaredRefs',
      });
    }
  }

  for (const vol of (spec.volumes || [])) {
    if (vol.configMap && !declaredSet.has(`ConfigMap/${vol.configMap.name}`)) {
      violations.push({
        kind: 'ConfigMap', name: vol.configMap.name,
        source: `volume "${vol.name}"`, reason: 'not declared in spec.declaredRefs',
      });
    }
    if (vol.secret && !declaredSet.has(`Secret/${vol.secret.secretName}`)) {
      violations.push({
        kind: 'Secret', name: vol.secret.secretName,
        source: `volume "${vol.name}"`, reason: 'not declared in spec.declaredRefs',
      });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'KW005',
      message: `${violations.length} undeclared ConfigMap/Secret reference(s)`,
      detail: {
        violations,
        hint: 'Add each reference to spec.declaredRefs: [{ kind: "ConfigMap"|"Secret", name: "..." }]',
      },
    };
  }

  return {
    pass: true, code: 'KW005',
    message: `All ConfigMap/Secret references are declared (${(spec.declaredRefs || []).length} total)`,
  };
}
