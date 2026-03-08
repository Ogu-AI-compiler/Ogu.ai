---
name: kubernetes-workload
description: Compiler skill for the kubernetes_workload compiler. Activates when producing k8s-workload-artifact.json. Gates: KW001–KW008. No upstream dependency.
---

# kubernetes-workload — Compiler Skill

## What This Compiler Does

Compiles the Kubernetes workload specification (Deployment/StatefulSet/DaemonSet) — selector labels, resource requests/limits, image tag safety, rollout strategy, and production invariants. Enforces: selector labels match pod template labels, all containers have CPU/memory requests and memory limits, image tags are pinned (no `:latest`/`:dev`/`:main`), rollout strategy is valid, and liveness/readiness probes are declared.

**Upstream dependency:** none
**Output artifact:** `k8s-workload-artifact.json`
**IR identifier:** `K8S_WORKLOAD:{project}`

---

## Spec Shape

```json
{
  "name": "api",
  "kind": "Deployment",
  "image": "registry.example.com/api:1.4.2",
  "replicas": 3,
  "namespace": "production",
  "selector": { "app": "api", "tier": "backend" },
  "containers": [
    {
      "name": "api",
      "image": "registry.example.com/api:1.4.2",
      "resources": {
        "requests": { "cpu": "250m", "memory": "256Mi" },
        "limits": { "memory": "512Mi" }
      }
    }
  ],
  "rolloutStrategy": {
    "type": "RollingUpdate",
    "maxSurge": 1,
    "maxUnavailable": 0
  },
  "livenessProbe": {
    "httpGet": { "path": "/health/live", "port": 3000 },
    "initialDelaySeconds": 30,
    "periodSeconds": 10
  },
  "readinessProbe": {
    "httpGet": { "path": "/health/ready", "port": 3000 },
    "initialDelaySeconds": 10,
    "periodSeconds": 5
  }
}
```

Required fields:
- `name` — workload name
- `kind` — `Deployment`, `StatefulSet`, or `DaemonSet`
- `image` — container image reference
- `replicas` — non-negative integer

---

## Gates

### KW001 — spec-valid
Reads `k8s-workload-spec.json`. Required: `name`, `kind` (valid), `image`, `replicas` (non-negative integer).

Hard-fails if `k8s-workload-spec.json` is missing.

### KW002 — selector-labels-match
Pod template labels must include all selector labels. K8s rejects deployments where the selector doesn't match the pod template.

BAD:
```json
{
  "selector": { "app": "api" },
  "podLabels": { "app": "backend" }
}
// selector "app=api" won't match pod label "app=backend"
```
GOOD: All selector key-value pairs appear in pod template labels.

### KW003 — containers-have-resources
Every container must declare:
- CPU and memory `requests`
- Memory `limits` (CPU limit is optional but memory limit is required)

In single-container mode (no `containers` array), root-level `resources` is used.

BAD:
```json
{ "containers": [{ "name": "api", "image": "api:1.0" }] }
// no resources — pods scheduled on random nodes, OOMKilled silently
```
GOOD:
```json
{
  "resources": {
    "requests": { "cpu": "250m", "memory": "256Mi" },
    "limits": { "memory": "512Mi" }
  }
}
```

### KW004 — image-refs-valid
Container images must not use mutable tags. Rejected tags: `:latest`, `:dev`, `:main`, `:master`, `:edge`, `:stable`, `:nightly`, `:canary`. Images with no tag are also rejected.

BAD:
```json
{ "image": "myapp:latest" }
{ "image": "myapp:dev" }
{ "image": "myapp" }
```
GOOD:
```json
{ "image": "registry.example.com/myapp:1.4.2" }
{ "image": "myapp@sha256:abc123..." }
```

### KW005 — refs-declared
Config map refs, secret refs, and persistent volume claim refs must reference declared resources. Dangling references cause pods to fail to start with `CreateContainerConfigError`.

### KW006 — rollout-strategy-valid
Skipped if `rolloutStrategy` is not declared. When declared:
- `type` must be `RollingUpdate` or `Recreate`
- `maxSurge` and `maxUnavailable` must be non-negative integers or valid percentages (e.g. `"25%"`)

BAD:
```json
{ "rolloutStrategy": { "type": "BlueGreen" } }
// not a valid K8s strategy
```
```json
{ "rolloutStrategy": { "type": "RollingUpdate", "maxSurge": -1 } }
// negative maxSurge
```
GOOD:
```json
{ "rolloutStrategy": { "type": "RollingUpdate", "maxSurge": 1, "maxUnavailable": 0 } }
```

### KW007 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### KW008 — contract-workload
Final contract checks:
- `livenessProbe` and `readinessProbe` must be declared (escape: `skipProbeCheck: true`)
- Single-replica Deployment without HPA is flagged (escape: `skipSingleReplicaCheck: true`)
- `namespace` must be declared

BAD:
```json
{ "name": "api", "kind": "Deployment", "image": "api:1.0", "replicas": 1 }
// no probes, no namespace, single replica
```
GOOD:
```json
{
  "namespace": "production",
  "replicas": 3,
  "livenessProbe": { "httpGet": { "path": "/health/live", "port": 3000 } },
  "readinessProbe": { "httpGet": { "path": "/health/ready", "port": 3000 } }
}
```

---

## What This Compiler Never Forgives

- `k8s-workload-spec.json` missing (KW001 hard-fails)
- `name`, `kind`, `image`, or `replicas` missing (KW001)
- `kind` not `Deployment`/`StatefulSet`/`DaemonSet` (KW001)
- `replicas` is negative (KW001)
- Selector labels don't match pod template labels (KW002)
- Container missing CPU/memory requests (KW003)
- Container missing memory limits (KW003)
- Image tag is `:latest`, `:dev`, `:main`, `:master`, `:edge`, `:stable`, `:nightly`, `:canary`, or absent (KW004)
- Rollout strategy `type` not `RollingUpdate`/`Recreate` (KW006)
- `maxSurge` or `maxUnavailable` negative (KW006)
- `livenessProbe` or `readinessProbe` missing without `skipProbeCheck` (KW008)
- `namespace` not declared (KW008)
