---
name: kubernetes-ingress-gateway
description: Compiler skill for the kubernetes_ingress_gateway compiler. Activates when producing k8s-ingress-artifact.json. Gates: KI001–KI007. No upstream dependency.
---

# kubernetes-ingress-gateway — Compiler Skill

## What This Compiler Does

Compiles the Kubernetes Ingress/Gateway API configuration — routing rules, backend service references, TLS configuration, hostname validation, and path rules. Enforces: backends reference declared services, hostnames are valid FQDNs, TLS hosts match routing rules, path rules start with `/` and use valid pathTypes, and public ingress has TLS configured.

**Upstream dependency:** none
**Output artifact:** `k8s-ingress-artifact.json`
**IR identifier:** `K8S_INGRESS:{project}`

---

## Spec Shape

```json
{
  "name": "api-ingress",
  "kind": "Ingress",
  "rules": [
    {
      "host": "api.example.com",
      "paths": [
        { "path": "/", "pathType": "Prefix", "backend": { "service": "api-service", "port": 3000 } }
      ]
    },
    {
      "host": "admin.example.com",
      "paths": [
        { "path": "/admin", "pathType": "Exact", "backend": { "service": "admin-service", "port": 8080 } }
      ]
    }
  ],
  "tls": [
    { "hosts": ["api.example.com", "admin.example.com"], "secretName": "tls-cert" }
  ],
  "ingressClass": "nginx",
  "namespace": "production"
}
```

Required fields:
- `name` — ingress name
- `rules` — non-empty array, each with `host` and `paths`

Valid kinds: `Ingress`, `Gateway`, `HTTPRoute`, `GRPCRoute`

---

## Gates

### KI001 — spec-valid
Reads `k8s-ingress-spec.json`. Required: `name`, `rules` (non-empty array, each with `host` and `paths`).

Hard-fails if `k8s-ingress-spec.json` is missing.

### KI002 — backends-resolve
Backend service references must correspond to declared Kubernetes Services. If a `k8s-service-artifact.json` exists in the project, backend service names are validated against it.

### KI003 — hostnames-valid
All `host` values in rules must be valid FQDNs (Fully Qualified Domain Names). Wildcard hosts (`*.example.com`) are allowed. IP addresses are not valid hostnames for Ingress rules.

BAD:
```json
{ "host": "my service" }
{ "host": "192.168.1.1" }
```
GOOD:
```json
{ "host": "api.example.com" }
{ "host": "*.example.com" }
```

### KI004 — tls-consistent
Skipped if `spec.tls` is not declared. When declared:
- Every TLS `hosts` entry must also appear in a routing rule host
- Each TLS entry must have both `secretName` and `hosts`

BAD:
```json
{
  "rules": [{ "host": "api.example.com", "paths": [...] }],
  "tls": [{ "hosts": ["api.example.com", "orphan.example.com"], "secretName": "cert" }]
}
// orphan.example.com in TLS but no routing rule
```
GOOD: All TLS hosts also appear in routing rules.

### KI005 — path-rules-valid
All paths must:
- Start with `/`
- Use a valid `pathType`: `Prefix`, `Exact`, `ImplementationSpecific`, `PathPrefix`, `RegularExpression`

BAD:
```json
{ "path": "api/v1", "pathType": "Exact" }
// path must start with /
```
```json
{ "path": "/api", "pathType": "Glob" }
// invalid pathType
```
GOOD:
```json
{ "path": "/api/v1", "pathType": "Prefix" }
```

### KI006 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### KI007 — contract-ingress
Final contract checks:
- Public-facing ingress must have `tls` configured (escape: `skipTlsCheck: true` for internal-only)
- `ingressClass` or `kubernetes.io/ingress.class` annotation must be declared — without it, all Ingress controllers attempt to claim this resource

BAD:
```json
{
  "name": "api",
  "rules": [{ "host": "api.example.com", "paths": [{ "path": "/", "pathType": "Prefix", "backend": {} }] }]
}
// public host with no TLS, no ingressClass
```
GOOD:
```json
{
  "ingressClass": "nginx",
  "tls": [{ "hosts": ["api.example.com"], "secretName": "api-tls" }]
}
```

---

## What This Compiler Never Forgives

- `k8s-ingress-spec.json` missing (KI001 hard-fails)
- `name` or `rules` missing (KI001)
- `rules` empty (KI001)
- Invalid hostname (IP address, contains spaces) (KI003)
- TLS host not appearing in routing rules (KI004)
- TLS entry missing `secretName` or `hosts` (KI004)
- Path not starting with `/` (KI005)
- Invalid `pathType` value (KI005)
- Public ingress without TLS and without `skipTlsCheck` (KI007)
- No `ingressClass` or ingress class annotation (KI007)
