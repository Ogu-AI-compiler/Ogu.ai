---
name: healthcheck-probe-config
description: Compiler skill for the healthcheck_probe_config compiler. Activates when producing probe-config-artifact.json. Gates: PC001–PC007. No upstream dependency.
---

# healthcheck-probe-config — Compiler Skill

## What This Compiler Does

Compiles the Kubernetes liveness/readiness/startup probe configuration — probe types, port references, threshold values, and K8s invariants. Enforces: container ports are declared, each probe uses exactly one of httpGet/tcpSocket/exec/grpc, threshold values are valid positive integers, liveness `successThreshold` must be exactly 1, both liveness and readiness probes are defined, and startup timing invariants are met.

**Upstream dependency:** none
**Output artifact:** `probe-config-artifact.json`
**IR identifier:** `PROBE_CONFIG:{project}`

---

## Spec Shape

```json
{
  "containerPorts": [
    { "name": "http", "port": 3000 },
    { "name": "metrics", "port": 9090 }
  ],
  "probes": {
    "liveness": {
      "httpGet": { "path": "/health/live", "port": 3000 },
      "initialDelaySeconds": 30,
      "periodSeconds": 10,
      "timeoutSeconds": 5,
      "failureThreshold": 3,
      "successThreshold": 1
    },
    "readiness": {
      "httpGet": { "path": "/health/ready", "port": 3000 },
      "initialDelaySeconds": 10,
      "periodSeconds": 5,
      "timeoutSeconds": 3,
      "failureThreshold": 3,
      "successThreshold": 1
    },
    "startup": {
      "httpGet": { "path": "/health/startup", "port": 3000 },
      "initialDelaySeconds": 0,
      "periodSeconds": 10,
      "failureThreshold": 30
    }
  }
}
```

Required fields:
- `containerPorts` — non-empty array, each with `name` and `port`
- `probes` — object with at least `liveness` and `readiness`

---

## Gates

### PC001 — spec-valid
Reads `probe-config-spec.json`. Required: `containerPorts` (non-empty array, each with `name` and `port`), `probes` object.

Hard-fails if `probe-config-spec.json` is missing.

### PC002 — ports-exist
Ports referenced in probe configurations must appear in `containerPorts`. Probing a port that is not declared will never connect.

### PC003 — probe-schema-valid
Each probe must use exactly one check type:
- `httpGet` — requires `path` (starts with `/`) and `port`
- `tcpSocket` — requires `port`
- `exec` — requires `command` (non-empty array)
- `grpc` — requires `port`

Multiple check types on the same probe are rejected.

BAD:
```json
{ "liveness": { "httpGet": { "path": "/health" }, "exec": { "command": ["check.sh"] } } }
// two check types — only one allowed
```
```json
{ "liveness": { "httpGet": { "path": "health", "port": 3000 } } }
// path must start with /
```
GOOD:
```json
{ "liveness": { "httpGet": { "path": "/health/live", "port": 3000 } } }
```

### PC004 — thresholds-valid
`initialDelaySeconds`, `periodSeconds`, `timeoutSeconds`, `successThreshold`, `failureThreshold` must all be positive integers when declared.

**Special rule:** `liveness.successThreshold` must be exactly `1`. K8s does not support values other than 1 for liveness probes.

BAD:
```json
{ "liveness": { "successThreshold": 2 } }
// K8s rejects successThreshold != 1 for liveness
```
```json
{ "readiness": { "periodSeconds": 0 } }
// zero not allowed
```
GOOD:
```json
{ "liveness": { "successThreshold": 1, "failureThreshold": 3, "periodSeconds": 10 } }
```

### PC005 — both-probes-defined
Both `liveness` and `readiness` probes must be declared. Without liveness, crashed containers are not restarted. Without readiness, broken containers still receive traffic.

Escape: `skipProbeRequirement: true`.

BAD:
```json
{ "probes": { "liveness": { "httpGet": { "path": "/health", "port": 3000 } } } }
// missing readiness
```
GOOD:
```json
{ "probes": { "liveness": { ... }, "readiness": { ... } } }
```

### PC006 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### PC007 — contract-probe
Final contract checks:
- `liveness.initialDelaySeconds` must be ≥ the startup window: `startup.periodSeconds × startup.failureThreshold` (when a startup probe is defined)
- `readiness.failureThreshold` should be ≤ `liveness.failureThreshold` — readiness gives up first, liveness kills the container

BAD:
```json
{
  "startup": { "periodSeconds": 10, "failureThreshold": 30 },
  "liveness": { "initialDelaySeconds": 10 }
}
// liveness starts at 10s but startup probe takes up to 300s
```
GOOD:
```json
{
  "startup": { "periodSeconds": 10, "failureThreshold": 30 },
  "liveness": { "initialDelaySeconds": 300 }
}
```

---

## What This Compiler Never Forgives

- `probe-config-spec.json` missing (PC001 hard-fails)
- `containerPorts` missing or empty (PC001)
- `probes` object missing (PC001)
- Port referenced in probe not declared in `containerPorts` (PC002)
- Probe with multiple check types (httpGet + exec) (PC003)
- `httpGet.path` not starting with `/` (PC003)
- `httpGet` missing `path` or `port` (PC003)
- `exec` missing `command` array (PC003)
- `tcpSocket` or `grpc` missing `port` (PC003)
- Any threshold value ≤ 0 (PC004)
- `liveness.successThreshold` ≠ 1 (PC004)
- `liveness` or `readiness` missing without `skipProbeRequirement` (PC005)
- `liveness.initialDelaySeconds` < startup window (PC007)
