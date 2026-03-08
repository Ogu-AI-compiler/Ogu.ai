---
name: kubernetes-service
description: Compiler skill for the kubernetes_service compiler. Activates when producing k8s-service-artifact.json. Gates: KS001–KS007. No upstream dependency.
---

# kubernetes-service — Compiler Skill

## What This Compiler Does

Compiles the Kubernetes Service specification — selector labels, ports, service type, and namespace. Enforces: selector resolves to a declared workload, ports are valid (1–65535) with `targetPort` declared, no duplicate port numbers, service type is from the allowlist, and LoadBalancer type requires annotations.

**Upstream dependency:** none
**Output artifact:** `k8s-service-artifact.json`
**IR identifier:** `K8S_SERVICE:{project}`

---

## Spec Shape

```json
{
  "name": "api-service",
  "selector": {
    "app": "api",
    "tier": "backend"
  },
  "ports": [
    { "name": "http", "port": 80, "targetPort": 3000, "protocol": "TCP" },
    { "name": "metrics", "port": 9090, "targetPort": 9090, "protocol": "TCP" }
  ],
  "type": "ClusterIP",
  "namespace": "production"
}
```

Required fields:
- `name` — service name
- `selector` — object with label key-value pairs
- `ports` — non-empty array

---

## Gates

### KS001 — spec-valid
Reads `k8s-service-spec.json`. Required: `name`, `selector` (object), `ports` (non-empty array).

Hard-fails if `k8s-service-spec.json` is missing.

### KS002 — selector-resolves
The `selector` labels must match labels on a declared workload. If a `k8s-workload-artifact.json` exists in the project, selector labels are cross-referenced. A service that selects no pods routes traffic to nothing.

### KS003 — ports-valid
Each port entry must have:
- `port` — integer 1–65535
- `targetPort` — declared (the container port to forward to)
- `protocol` — `TCP`, `UDP`, or `SCTP` (when declared)

BAD:
```json
{ "ports": [{ "port": 80 }] }
// missing targetPort
```
```json
{ "ports": [{ "port": 0, "targetPort": 3000 }] }
// port 0 invalid
```
GOOD:
```json
{ "ports": [{ "name": "http", "port": 80, "targetPort": 3000, "protocol": "TCP" }] }
```

### KS004 — no-duplicate-ports
No two ports may share the same `port` number. Duplicate ports are silently ignored by K8s but indicate a configuration error.

BAD:
```json
{ "ports": [
  { "port": 80, "targetPort": 3000 },
  { "port": 80, "targetPort": 8080 }
]}
// duplicate port 80
```
GOOD: All `port` values are unique.

### KS005 — service-type-allowed
`type` must be one of: `ClusterIP`, `NodePort`, `LoadBalancer`, `ExternalName`, `Headless`.

Headless service: `ClusterIP: None` — used for StatefulSets.

BAD:
```json
{ "type": "Internal" }
// not a valid K8s service type
```
GOOD:
```json
{ "type": "ClusterIP" }
```

### KS006 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### KS007 — contract-service
Final contract checks:
- `namespace` must be declared — Services without a namespace are created in `default` which is rarely correct for production workloads
- `LoadBalancer` type requires `annotations` — cloud provider load balancer configuration (ACM cert, internal/external, idle timeout) must be explicit

BAD:
```json
{ "name": "api", "selector": { "app": "api" }, "ports": [{ "port": 80, "targetPort": 3000 }], "type": "LoadBalancer" }
// LoadBalancer without annotations — no cert, no idle timeout config
```
GOOD:
```json
{
  "type": "LoadBalancer",
  "namespace": "production",
  "annotations": {
    "service.beta.kubernetes.io/aws-load-balancer-type": "external",
    "service.beta.kubernetes.io/aws-load-balancer-ssl-cert": "arn:aws:acm:..."
  }
}
```

---

## What This Compiler Never Forgives

- `k8s-service-spec.json` missing (KS001 hard-fails)
- `name`, `selector`, or `ports` missing (KS001)
- `ports` empty (KS001)
- Any port missing `targetPort` (KS003)
- Port number < 1 or > 65535 (KS003)
- Invalid `protocol` value (KS003)
- Duplicate `port` numbers (KS004)
- `type` not in valid list (KS005)
- `namespace` not declared (KS007)
- `type: "LoadBalancer"` without `annotations` (KS007)
