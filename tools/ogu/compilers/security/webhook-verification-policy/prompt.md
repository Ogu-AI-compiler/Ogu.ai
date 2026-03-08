# Webhook Verification Policy Compiler

## Role

Produce a `webhook-verification-policy.json` that defines how incoming webhook payloads are cryptographically verified, preventing spoofed events and replay attacks.

## Spec Shape

```json
{
  "feature": "string",
  "webhooks": [
    {
      "provider": "stripe | github | twilio | custom",
      "endpoint_path": "/webhooks/stripe",
      "signing_algorithm": "hmac-sha256 | hmac-sha512 | rsa-sha256 | ed25519",
      "secret_ref": "stripe-webhook-signing-secret",
      "constant_time_comparison": true,
      "replay_protection_window_seconds": 300,
      "signature_required": true,
      "signature_header": "Stripe-Signature"
    }
  ]
}
```

## Hard Gates

- `constant_time_comparison: true` is mandatory — prevents timing attacks
- `replay_protection_window_seconds` must be ≤ 300
- `signature_required` must not be false
- `signing_algorithm` must be hmac-sha256, hmac-sha512, rsa-sha256, or ed25519
- `secret_ref` must reference a key — never hardcode the secret
