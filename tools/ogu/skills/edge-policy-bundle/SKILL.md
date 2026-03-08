---
name: edge-policy-bundle
description: Compiler skill for the edge_policy_bundle compiler. Activates when producing edge-policy-artifact.json. Gates: EP001–EP007. No upstream dependency.
---

# edge-policy-bundle — Compiler Skill

## What This Compiler Does

Compiles the edge/CDN policy bundle — rate limits, CORS headers, WAF rules, and geo-restrictions. Enforces: every rule has a rate limit, CORS cannot combine wildcard origin with `allowCredentials: true`, WAF rules have valid actions and mode, geo-restrictions cannot have both allowlist and denylist simultaneously, and country codes are ISO 3166-1 alpha-2 format.

**Upstream dependency:** none
**Output artifact:** `edge-policy-artifact.json`
**IR identifier:** `EDGE_POLICY:{project}`

---

## Spec Shape

```json
{
  "name": "api-edge-policy",
  "rules": [
    {
      "name": "api-rate-limit",
      "match": { "path": "/api/*" },
      "rateLimit": {
        "requestsPerSecond": 100,
        "burst": 200,
        "keyBy": "ip"
      }
    },
    {
      "name": "auth-strict-limit",
      "match": { "path": "/auth/*" },
      "rateLimit": { "requestsPerMinute": 30 }
    }
  ],
  "cors": {
    "allowedOrigins": ["https://app.example.com", "https://admin.example.com"],
    "allowedMethods": ["GET", "POST", "PUT", "DELETE"],
    "allowCredentials": true,
    "maxAge": 86400
  },
  "waf": {
    "mode": "prevention",
    "rules": [
      { "id": "sqli-001", "match": "sql-injection", "action": "block" },
      { "id": "xss-001", "match": "xss", "action": "block" }
    ]
  },
  "geoRestrictions": {
    "denylist": ["KP", "IR"],
    "action": "block"
  }
}
```

Required fields:
- `name` — policy bundle name
- `rules` — non-empty array

---

## Gates

### EP001 — spec-valid
Reads `edge-policy-spec.json`. Required: `name`, `rules` (non-empty array).

Hard-fails if `edge-policy-spec.json` is missing.

### EP002 — rate-limits-defined
Every rule must have a `rateLimit` with either `requestsPerSecond` or `requestsPerMinute`. Rules without rate limits allow unbounded traffic.

Escape: `skipRateLimitRequirement: true`.

BAD:
```json
{ "rules": [{ "name": "api", "match": { "path": "/api/*" } }] }
// no rateLimit
```
GOOD:
```json
{ "rules": [{ "name": "api", "match": { "path": "/api/*" }, "rateLimit": { "requestsPerSecond": 100 } }] }
```

### EP003 — cors-headers-valid
Skipped if `spec.cors` is not declared. When declared:
- `allowedOrigins` is required
- `["*"]` (wildcard) combined with `allowCredentials: true` is forbidden — this is a security misconfiguration that exposes credentials to any origin
- `allowedMethods` must only contain valid HTTP methods: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`

BAD:
```json
{ "cors": { "allowedOrigins": ["*"], "allowCredentials": true } }
// wildcard + credentials — CORS misconfiguration
```
GOOD:
```json
{ "cors": { "allowedOrigins": ["https://app.example.com"], "allowCredentials": true } }
```

### EP004 — waf-rules-valid
Skipped if `spec.waf` is not declared. When declared:
- Each WAF rule must have `id`, `match`, and `action`
- Valid actions: `allow`, `block`, `challenge`, `log`, `redirect`
- `waf.mode` must be: `detection` or `prevention`

BAD:
```json
{ "waf": { "mode": "enabled", "rules": [{ "match": "sqli" }] } }
// invalid mode; rule missing id and action
```
GOOD:
```json
{ "waf": { "mode": "prevention", "rules": [{ "id": "sqli-001", "match": "sql-injection", "action": "block" }] } }
```

### EP005 — geo-restrictions-valid
Skipped if `spec.geoRestrictions` is not declared. When declared:
- Cannot have both `allowlist` and `denylist` simultaneously — contradictory policies
- All country codes must match ISO 3166-1 alpha-2 format: exactly two uppercase letters (`[A-Z]{2}`)

BAD:
```json
{ "geoRestrictions": { "allowlist": ["US"], "denylist": ["CN"] } }
// both allowlist and denylist
```
```json
{ "geoRestrictions": { "denylist": ["North Korea", "iran"] } }
// not ISO codes
```
GOOD:
```json
{ "geoRestrictions": { "denylist": ["KP", "IR"] } }
```

### EP006 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### EP007 — contract-edge
Final contract checks:
- Each rule must have `name` or `match` (cannot have neither)
- `requestsPerSecond` must be a positive number
- Policy `name` must be declared

BAD:
```json
{ "rules": [{ "rateLimit": { "requestsPerSecond": 100 } }] }
// rule has neither name nor match
```
GOOD: Every rule has `name` and/or `match`, and all rate limit values are positive.

---

## What This Compiler Never Forgives

- `edge-policy-spec.json` missing (EP001 hard-fails)
- `name` or `rules` missing (EP001)
- `rules` empty (EP001)
- Any rule missing `rateLimit` without `skipRateLimitRequirement` (EP002)
- Rule `rateLimit` without `requestsPerSecond` or `requestsPerMinute` (EP002)
- `cors.allowedOrigins: ["*"]` combined with `allowCredentials: true` (EP003)
- Invalid HTTP method in `allowedMethods` (EP003)
- WAF rule missing `id`, `match`, or `action` (EP004)
- WAF `action` not in valid list (EP004)
- `waf.mode` not `detection` or `prevention` (EP004)
- Geo-restrictions with both `allowlist` and `denylist` (EP005)
- Country codes not matching `[A-Z]{2}` format (EP005)
- Rule with neither `name` nor `match` (EP007)
