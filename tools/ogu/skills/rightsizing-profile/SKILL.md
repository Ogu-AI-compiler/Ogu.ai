---
name: rightsizing-profile
description: Compiler skill for the rightsizing_profile compiler. Activates when producing rightsizing-artifact.json. Gates: RS001–RS007. No upstream dependency.
---

# rightsizing-profile — Compiler Skill

## What This Compiler Does

Compiles the Kubernetes resource rightsizing profile — workload container resource requests/limits, HPA bounds, and node capacity constraints. Enforces: every container has CPU/memory requests and memory limits, container limits don't exceed node capacity, requests never exceed limits (K8s rejects such pods), and HPA min/max replicas are valid.

**Upstream dependency:** none
**Output artifact:** `rightsizing-artifact.json`
**IR identifier:** `RIGHTSIZING:{project}`

---

## Spec Shape

```json
{
  "service": "api",
  "workloads": [
    {
      "name": "api-deployment",
      "containers": [
        {
          "name": "api",
          "resources": {
            "requests": { "cpu": "250m", "memory": "256Mi" },
            "limits": { "cpu": "1000m", "memory": "512Mi" }
          }
        }
      ],
      "hpa": {
        "minReplicas": 2,
        "maxReplicas": 10,
        "targetCPUUtilizationPercentage": 70
      }
    }
  ],
  "nodeLimits": {
    "cpu": "4000m",
    "memory": "8Gi"
  }
}
```

Required fields:
- `service` — service name
- `workloads` — non-empty array, each with `name` and `containers`

---

## Gates

### RS001 — spec-valid
Reads `rightsizing-spec.json`. Required: `service`, `workloads` (non-empty array). Each workload needs `name` and `containers`.

Hard-fails if `rightsizing-spec.json` is missing.

### RS002 — requests-limits-present
Every container must declare:
- `resources.requests.cpu` — CPU request
- `resources.requests.memory` — memory request
- `resources.limits.memory` — memory limit (required; prevents OOMKill with no signal)

CPU limit is optional (can cause CPU throttling issues if set too low).

BAD:
```json
{ "containers": [{ "name": "api", "resources": { "requests": { "cpu": "250m" } } }] }
// missing memory request and memory limit
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

### RS003 — limits-not-exceed-node
Skipped if `spec.nodeLimits` is not declared. When declared, container resource limits must not exceed node capacity. A pod that requests more than a node can provide will never be scheduled.

Parsing: `1000m` = 1 CPU core; `1Gi` = 1024Mi.

BAD:
```json
{
  "nodeLimits": { "cpu": "4000m", "memory": "8Gi" },
  "containers": [{ "resources": { "limits": { "cpu": "8000m", "memory": "16Gi" } } }]
}
// limits exceed node capacity
```
GOOD: Container limits ≤ node limits.

### RS004 — requests-lte-limits
Kubernetes rejects pods where any resource request exceeds its limit. This gate catches the error before deployment.

BAD:
```json
{ "resources": {
  "requests": { "cpu": "2000m", "memory": "1Gi" },
  "limits": { "cpu": "1000m", "memory": "512Mi" }
}}
// requests > limits — K8s will reject this pod
```
GOOD: All requests ≤ their corresponding limits.

### RS005 — hpa-bounds-valid
Skipped if no workload declares `hpa`. When declared:
- `minReplicas` must be ≥ 1
- `maxReplicas` must be > `minReplicas`
- `targetCPUUtilizationPercentage` must be between 1 and 100

BAD:
```json
{ "hpa": { "minReplicas": 5, "maxReplicas": 3 } }
// min > max
```
```json
{ "hpa": { "minReplicas": 0, "maxReplicas": 10 } }
// min < 1
```
GOOD:
```json
{ "hpa": { "minReplicas": 2, "maxReplicas": 10, "targetCPUUtilizationPercentage": 70 } }
```

### RS006 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### RS007 — contract-rightsizing
Final contract checks:
- Each workload must have `name` field
- Each workload must have a non-empty `containers` array
- Each container must have `name`

BAD:
```json
{ "workloads": [{ "containers": [] }] }
// missing workload name, empty containers
```
GOOD: All workloads and containers have `name`, containers array is non-empty.

---

## What This Compiler Never Forgives

- `rightsizing-spec.json` missing (RS001 hard-fails)
- `service` or `workloads` missing (RS001)
- `workloads` empty (RS001)
- Any workload missing `name` or `containers` (RS001)
- Container missing `resources.requests.cpu` or `resources.requests.memory` (RS002)
- Container missing `resources.limits.memory` (RS002)
- Container limits exceed node capacity (RS003)
- Any resource request > its limit (RS004)
- `hpa.minReplicas` < 1 (RS005)
- `hpa.minReplicas` ≥ `hpa.maxReplicas` (RS005)
- `targetCPUUtilizationPercentage` < 1 or > 100 (RS005)
- Workload missing `name` (RS007)
- `containers` array empty (RS007)
