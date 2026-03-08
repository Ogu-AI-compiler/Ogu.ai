# Encryption Key Policy Compiler

## Role

Produce an `encryption-key-policy.json` that defines every cryptographic key used by the application: its algorithm, key length, single purpose, rotation schedule, and storage backend.

## Your Output

| File | Phase | Description |
|------|-------|-------------|
| `encryption-key-policy.json` | Phase 2 | The key policy spec |
| `encryption-key-policy.compiled.json` | Phase 5 | Compiler attestation — written on full pass |

## Spec Shape

```json
{
  "project": "string",
  "tls_managed_externally": false,
  "keys": [
    {
      "id": "string — unique kebab-case id",
      "algorithm": "string — e.g. aes-256-gcm, rsa-2048, ed25519, hmac-sha256",
      "purpose": "string — single, specific use (e.g. user-pii-at-rest-encryption)",
      "key_length_bits": 256,
      "rotation_days": 90,
      "storage_backend": "vault | aws_kms | gcp_kms | azure_key_vault | hsm",
      "coverage": "string — at-rest | transit | signing | kek",
      "environments": ["staging", "prod"],
      "notes": "string — optional"
    }
  ]
}
```

## Approved Algorithms

| Family | Approved | Minimum Bits |
|--------|---------|-------------|
| Symmetric | aes-256-gcm, aes-128-gcm, chacha20-poly1305 | 128 |
| Asymmetric | rsa-2048+, ecdsa-p256+, ed25519, ed448 | 2048 (RSA), 256 (EC) |
| HMAC | hmac-sha256, hmac-sha384, hmac-sha512 | 256 |
| Password | argon2id, bcrypt, scrypt | N/A |

**Never use:** MD5, SHA-1, DES, 3DES, RC4, RC2, AES-ECB, RSA-1024

## Hard Gates

### EK002 — Approved algorithms only
Any deprecated algorithm causes a hard failure. `aes-256-ecb` and similar ECB-mode variants are also banned (no IV = deterministic encryption = pattern leakage).

### EK004 — Single purpose per key
A key that is used for both encryption and signing is a single-purpose violation. Separate keys must be declared.

**BAD:** `"purpose": "encryption and signing"`
**GOOD:** Two separate keys — one for encryption, one for signing.

### EK005 — Transit and storage both covered
Unless `tls_managed_externally: true`, the policy must include at least one key for data-in-transit and one for data-at-rest.

## Contract (Gold Standard)

```json
{
  "project": "api-service",
  "tls_managed_externally": true,
  "keys": [
    {
      "id": "user-pii-at-rest",
      "algorithm": "aes-256-gcm",
      "purpose": "user-pii-field-level-encryption",
      "key_length_bits": 256,
      "rotation_days": 365,
      "storage_backend": "aws_kms",
      "coverage": "at-rest",
      "environments": ["staging", "prod"]
    },
    {
      "id": "jwt-signing",
      "algorithm": "ed25519",
      "purpose": "jwt-token-signing",
      "key_length_bits": 256,
      "rotation_days": 30,
      "storage_backend": "vault",
      "coverage": "signing",
      "environments": ["dev", "staging", "prod"]
    }
  ]
}
```

## What You Never Do

- Never use MD5, SHA-1, DES, 3DES, RC4, AES-ECB
- Never declare a key with multiple purposes in a single entry
- Never set `rotation_days` above 730
- Never set `rotation_days` above 90 for JWT/token signing keys
- Never use RSA with fewer than 2048 bits
- Never leave `storage_backend` as `env_var` — keys must be in a KMS or HSM
