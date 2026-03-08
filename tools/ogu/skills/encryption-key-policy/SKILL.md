---
name: encryption-key-policy
description: Compiler skill for the encryption-key-policy compiler. Activates when producing encryption-key-policy.json. Gates: EK001–EK007. Upstream: secret-handling-policy.compiled.json.
---

# encryption-key-policy — Compiler Skill

## What This Compiler Does

Compiles the encryption key management policy. Enforces only approved algorithms (NIST 2024+), minimum key lengths, single-purpose keys, both transit and storage coverage, and rotation intervals within the annual maximum.

**Upstream dependency:** `secret-handling-policy.compiled.json`
**Output artifact:** `encryption-key-policy.compiled.json`
**Spec file you write:** `encryption-key-policy.json`

---

## Spec Shape

```json
{
  "project": "my-saas-app",
  "keys": [
    {
      "id": "user-data-at-rest",
      "algorithm": "aes-256-gcm",
      "purpose": "user-data-at-rest-encryption",
      "key_length_bits": 256,
      "rotation_days": 365,
      "storage_backend": "vault"
    },
    {
      "id": "jwt-signing",
      "algorithm": "ed25519",
      "purpose": "jwt-token-signing",
      "key_length_bits": 256,
      "rotation_days": 90,
      "storage_backend": "vault"
    },
    {
      "id": "tls-cert",
      "algorithm": "ecdsa-p256",
      "purpose": "tls-transport-encryption",
      "key_length_bits": 256,
      "rotation_days": 365,
      "storage_backend": "acm"
    }
  ]
}
```

---

## Gates

### EK001 — spec-valid
Reads `encryption-key-policy.json`. Skips (pass) if file absent.

Required top-level fields: `project` (string), `keys` (non-empty array).

Required per-key fields: `id`, `algorithm`, `purpose`, `key_length_bits` (number), `rotation_days` (positive number), `storage_backend`.

### EK002 — approved-algorithms
Algorithm values compared case-insensitively. Hard-blocked (deprecated): `md5`, `sha1`, `sha-1`, `des`, `3des`, `triple-des`, `rc4`, `rc2`, `aes-256-ecb`, `aes-128-ecb`, `rsa-1024`, `dsa-1024`.

Approved symmetric: `aes-256-gcm`, `aes-128-gcm`, `aes-256-cbc`, `aes-128-cbc`, `chacha20-poly1305`, `aes-256`, `aes-128`.

Approved asymmetric: `rsa-2048`, `rsa-3072`, `rsa-4096`, `ecdsa-p256`, `ecdsa-p384`, `ecdsa-p521`, `ed25519`, `ed448`, `ecdh-p256`, `ecdh-p384`, `x25519`, `x448`.

Approved hashing/KDF: `sha-256`, `sha-384`, `sha-512`, `sha3-256`, `sha3-512`, `hmac-sha256`, `hmac-sha512`, `argon2id`, `bcrypt`, `scrypt`.

BAD: `"algorithm": "SHA1"` — deprecated.
BAD: `"algorithm": "aes-256-ecb"` — ECB mode is deprecated.
GOOD: `"algorithm": "aes-256-gcm"`.

### EK003 — minimum-key-length
Minimum thresholds (not exact enforcement):
- AES: `key_length_bits` ≥ 128
- RSA: `key_length_bits` ≥ 2048
- ECDSA/Ed: 256-bit is acceptable

BAD: `"algorithm": "rsa-2048", "key_length_bits": 1024`.
GOOD: `"algorithm": "rsa-2048", "key_length_bits": 2048`.

### EK004 — no-key-reuse-across-purposes
`purpose` must be a single, specific non-empty string. Fails if:
- Contains ` and `, ` & `, `,`, `;`, or `/` (compound purpose)
- Equals `"all"`, `"general"`, or `"*"` (too broad)
- `uses` array (alternative field) has more than 1 entry

BAD: `"purpose": "signing and encryption"` — compound.
BAD: `"purpose": "all"` — too broad.
GOOD: `"purpose": "user-data-at-rest-encryption"`.

### EK005 — transit-and-storage-covered
The `keys` array must contain:
- At least one key whose `purpose` contains a transit keyword: `tls`, `transit`, `transport`, `https`
- At least one key whose `purpose` contains a storage keyword: `at-rest`, `storage`, `encrypt`, `database`

Both coverage areas must be present.

BAD: all keys have `purpose: "jwt-signing"` — neither transit nor storage covered.
GOOD: one key with `"purpose": "tls-transport-encryption"` + one with `"purpose": "user-data-at-rest-encryption"`.

### EK006 — rotation-interval-reasonable
`rotation_days` must be a positive number ≤ 365. Keys that never rotate exceed the annual maximum.

BAD: `"rotation_days": 730`.
GOOD: `"rotation_days": 365`.

### EK007 — no-todos
No `TODO`, `FIXME`, or `HACK` anywhere in `encryption-key-policy.json`.

---

## What This Compiler Never Forgives

- Any deprecated algorithm: MD5, SHA1, DES, 3DES, RC4, ECB mode, RSA-1024
- Compound purpose — one key for two uses
- Missing transit or storage coverage (both must exist)
- `rotation_days > 365`
