---
name: ux-recovery-flow
description: Compiler skill for the ux-recovery-flow compiler. Activates when producing recovery-flow-artifact.json. Gates: URF001–URF008. No upstream dependency.
---

# ux-recovery-flow — Compiler Skill

## What This Compiler Does

Compiles the error recovery flow specification — failure scenarios, recovery actions, retry limits, escape hatches for critical failures, offline fallbacks, user message quality, and backoff strategy. Enforces: every failure has at least one recovery action, retry limits are bounded (1–10), critical/fatal failures have an escape hatch, offline failures declare a fallback, user messages are specific (not generic), and multi-retry recoveries declare a backoff strategy.

**Upstream dependency:** none
**Output artifact:** `recovery-flow-artifact.json`
**IR identifier:** `UX_RECOVERY_FLOW:{project}`

---

## Spec Shape

```json
{
  "version": "1.0",
  "failures": [
    {
      "id": "api-timeout",
      "trigger": "network request timeout after 30s",
      "severity": "medium",
      "userMessage": "The request is taking longer than expected. Please try again.",
      "recovery": {
        "retry": true,
        "maxRetries": 3,
        "backoff": "exponential",
        "fallback": "Show cached data if available"
      }
    },
    {
      "id": "payment-declined",
      "trigger": "payment gateway returns decline code",
      "severity": "high",
      "userMessage": "Your payment was declined. Please check your card details and try again.",
      "recovery": {
        "redirect": "/payment/update-method",
        "contactSupport": "contact support if problem persists"
      }
    },
    {
      "id": "data-corruption",
      "trigger": "server returns malformed response",
      "severity": "critical",
      "userMessage": "We encountered a critical error. Your data is safe. Please contact support.",
      "escapeHatch": "contact-support",
      "recovery": {
        "contactSupport": "Open support ticket",
        "redirect": "/dashboard"
      }
    },
    {
      "id": "offline-sync",
      "trigger": "network offline detected",
      "severity": "medium",
      "userMessage": "You are offline. Changes will sync when you reconnect.",
      "recovery": {
        "fallback": "Queue changes locally and sync on reconnect"
      }
    }
  ]
}
```

Required fields:
- `version` — string (required for contract gate)
- `failures` — non-empty array, each with `id`, `trigger`, `recovery` (object)

---

## Gates

### URF001 — spec-valid
Reads `recovery-flow-spec.json`. Required: `failures` (non-empty array). Each failure needs: `id` (string), `trigger` (string), `recovery` (object).

### URF002 — all-failures-covered
Every failure's `recovery` object must declare at least one recognized action: `retry`, `redirect`, `fallback`, or `contactSupport`. An empty recovery object means the user has no path forward.

BAD:
```json
{ "id": "api-error", "trigger": "500 error", "recovery": {} }
// No recognized recovery action
```
GOOD:
```json
{ "recovery": { "retry": true, "maxRetries": 3 } }
{ "recovery": { "redirect": "/error-page" } }
{ "recovery": { "fallback": "Show cached data" } }
```

### URF003 — retry-limits
When `recovery.retry: true`, `maxRetries` must be declared (integer 1–10). Infinite retry (`retry:true` with no `maxRetries`) is always a violation.

BAD:
```json
{ "recovery": { "retry": true } }
// No maxRetries — infinite retry
```
BAD:
```json
{ "recovery": { "retry": true, "maxRetries": 20 } }
// Exceeds cap of 10
```
GOOD:
```json
{ "recovery": { "retry": true, "maxRetries": 3, "backoff": "exponential" } }
```

### URF004 — escape-hatch
Failures with `severity: "critical"` or `severity: "fatal"` must declare `escapeHatch` (non-empty string — an action that returns the user to a known safe state, e.g., `"contact-support"`, `"go-home"`, `"reload"`).

BAD:
```json
{ "id": "data-loss", "severity": "critical", "recovery": { "redirect": "/home" } }
// No escapeHatch for critical failure
```
GOOD:
```json
{ "id": "data-loss", "severity": "critical", "escapeHatch": "contact-support", "recovery": { "contactSupport": "Open ticket" } }
```

### URF005 — offline-fallback
Any failure whose `trigger` contains "offline" or "network" must have `recovery.fallback` declared. Network failures without a fallback leave users stranded.

BAD:
```json
{ "id": "offline", "trigger": "network offline detected", "recovery": { "retry": true, "maxRetries": 3 } }
// No fallback for offline trigger
```
GOOD:
```json
{ "trigger": "network offline detected", "recovery": { "fallback": "Queue locally and sync on reconnect" } }
```

### URF006 — error-message-quality
Every failure must declare `userMessage` (non-empty string). The message must NOT be a generic placeholder (case-insensitive exact match):
- `"An error occurred"`
- `"Something went wrong"`
- `"Error"`
- `"Unknown error"`

Escape hatch: `failure.genericMessageOk: true`

BAD:
```json
{ "userMessage": "Something went wrong" }
{ "userMessage": "An error occurred" }
```
GOOD:
```json
{ "userMessage": "Your payment was declined. Please check your card details and try again." }
```

### URF007 — backoff-declared
When `recovery.retry: true` AND `maxRetries > 1`, `recovery.backoff` must be declared as one of: `"linear"`, `"exponential"`, or `"fixed"`. Without backoff, retries hammer the server at full rate.

BAD:
```json
{ "recovery": { "retry": true, "maxRetries": 3 } }
// Multi-retry but no backoff
```
GOOD:
```json
{ "recovery": { "retry": true, "maxRetries": 3, "backoff": "exponential" } }
```

### URF008 — contract-recovery-flow
Final contract check:
- `version` declared
- All failure `id` values are unique
- At least one failure declared

---

## What This Compiler Never Forgives

- `recovery-flow-spec.json` missing — gate skipped (soft, not hard-fail)
- Any failure missing `id`, `trigger`, or `recovery` (URF001)
- Recovery with no recognized action (retry/redirect/fallback/contactSupport) (URF002)
- `retry: true` without `maxRetries` — infinite retry (URF003)
- `maxRetries > 10` (URF003)
- Critical/fatal failure without `escapeHatch` (URF004)
- Offline/network trigger without `fallback` (URF005)
- Missing or generic `userMessage` (URF006)
- Multi-retry (maxRetries > 1) without `backoff` (URF007)
- Duplicate failure ids (URF008)
- `version` missing (URF008)
