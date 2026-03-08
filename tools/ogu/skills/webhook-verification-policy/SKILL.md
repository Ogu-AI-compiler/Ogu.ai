---
name: webhook-verification-policy
description: Compiler skill for the webhook-verification-policy compiler. Activates when producing webhook-verification-policy.json. Gates: WV001–WV006. Upstream: secret-handling-policy.compiled.json.
---

# webhook-verification-policy — Compiler Skill

## What This Compiler Does

Compiles the webhook signature verification policy. Enforces constant-time comparison (to prevent timing attacks), replay protection window, signature verification on every endpoint, and TLS enforcement.

**Upstream dependency:** `secret-handling-policy.compiled.json`
**Output artifact:** `webhook-verification-policy.compiled.json`
**Spec file you write:** `webhook-verification-policy.json`

---

## Spec Shape

```json
{
  "feature": "stripe-webhooks",
  "signature_algorithm": "hmac-sha256",
  "signature_header": "Stripe-Signature",
  "replay_window_seconds": 300,
  "constant_time_comparison": true,
  "tls_required": true,
  "endpoints": [
    {
      "path": "/webhooks/stripe",
      "provider": "stripe",
      "signature_verification_required": true,
      "constant_time_comparison": true,
      "tls_required": true
    }
  ]
}
```

---

## Gates

### WV001 — spec-valid
Reads `webhook-verification-policy.json`. Skips (pass) if file absent.

Required top-level fields: `endpoints` (non-empty array), `signature_algorithm` (string), `signature_header` (string), `replay_window_seconds` (positive number).

### WV002 — constant-time-comparison
Either the top-level spec has `"constant_time_comparison": true`, or every endpoint has it. If neither is set, the gate fails.

Why this matters: string comparison with `===` leaks timing information. An attacker can recover the expected HMAC byte by byte. You must use `crypto.timingSafeEqual`.

BAD: no `constant_time_comparison` field anywhere in the spec.
GOOD: `"constant_time_comparison": true` at the top level.

### WV003 — replay-protection-window
`replay_window_seconds` must be a positive integer. Recommended: `300` (5 minutes). The gate fails if missing or ≤ 0.

BAD: no `replay_window_seconds` field.
GOOD: `"replay_window_seconds": 300`.

### WV004 — signature-required
Every endpoint in `endpoints[]` must set `"signature_verification_required": true`.

BAD: `{ "path": "/webhooks/github" }` — no `signature_verification_required` field.
GOOD: `{ "path": "/webhooks/github", "signature_verification_required": true }`.

### WV005 — no-todos
No `TODO`, `FIXME`, or `HACK` anywhere in `webhook-verification-policy.json`.

### WV006 — tls-required
Either `"tls_required": true` at the top level, or every endpoint has it. Webhook receivers that allow HTTP expose the payload to interception.

BAD: no `tls_required` field.
GOOD: `"tls_required": true` at top level.

---

## What This Compiler Never Forgives

- Missing `constant_time_comparison: true` — enables timing attack on HMAC signature
- Missing `replay_window_seconds` — allows replayed webhook requests
- Any endpoint without `signature_verification_required: true`
- Missing `tls_required: true`
