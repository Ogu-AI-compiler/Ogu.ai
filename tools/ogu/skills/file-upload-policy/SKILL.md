---
name: file-upload-policy
description: Compiler skill for the file-upload-policy compiler. Activates when producing file-upload-policy.json. Gates: FU001–FU006. Upstream: input-validation-policy.compiled.json.
---

# file-upload-policy — Compiler Skill

## What This Compiler Does

Compiles the file upload security policy. Enforces that storage defaults to private, dangerous file extensions are blocked, malware scanning is declared before files are accessible, and server-side MIME type validation is required.

**Upstream dependency:** `input-validation-policy.compiled.json`
**Output artifact:** `file-upload-policy.compiled.json`
**Spec file you write:** `file-upload-policy.json`

---

## Spec Shape

```json
{
  "feature": "user-avatar-upload",
  "storage_acl": "private",
  "allowed_extensions": [".jpg", ".jpeg", ".png", ".webp", ".gif"],
  "allowed_mime_types": ["image/jpeg", "image/png", "image/webp", "image/gif"],
  "max_size_bytes": 5242880,
  "mime_validated_server_side": true,
  "malware_scan": {
    "enabled": true,
    "scan_before_accessible": true,
    "provider": "clamav"
  }
}
```

---

## Gates

### FU001 — spec-valid
Reads `file-upload-policy.json`. Skips (pass) if file absent.

Required top-level fields: `allowed_extensions` (non-empty array), `max_size_bytes` (positive number), `storage_acl` (string), `malware_scan` (object).

### FU002 — no-public-read-default
`storage_acl` must not be `"public-read"`, `"public"`, or `"public_read"`. All uploads must default to private.

BAD: `"storage_acl": "public-read"` — any uploaded file is immediately world-readable.
GOOD: `"storage_acl": "private"`.

### FU003 — dangerous-extensions-blocked
`allowed_extensions` must not contain any of these dangerous extensions:
`.exe`, `.sh`, `.bash`, `.bat`, `.cmd`, `.ps1`, `.psm1`, `.php`, `.phar`, `.php3`, `.php5`, `.phtml`, `.jar`, `.py`, `.rb`, `.pl`, `.cgi`, `.asp`, `.aspx`, `.jsp`.

BAD: `"allowed_extensions": [".jpg", ".php"]`.
GOOD: `"allowed_extensions": [".jpg", ".jpeg", ".png"]`.

### FU004 — malware-scan-declared
`malware_scan` object must exist and `malware_scan.enabled` must be `true`.

BAD: `"malware_scan": { "enabled": false }`.
BAD: no `malware_scan` field at all.
GOOD: `"malware_scan": { "enabled": true, "scan_before_accessible": true }`.

### FU005 — no-todos
No `TODO`, `FIXME`, or `HACK` anywhere in `file-upload-policy.json`.

### FU006 — content-type-validated
The spec must declare `"allowed_mime_types"` (non-empty array) AND `"mime_validated_server_side": true`. Extension-only validation is bypassable by renaming a `.php` file to `.jpg`.

BAD: only `allowed_extensions` defined, no `allowed_mime_types`.
GOOD: `"allowed_mime_types": ["image/jpeg", "image/png"]` + `"mime_validated_server_side": true`.

---

## What This Compiler Never Forgives

- `storage_acl: "public-read"` — all uploads instantly public
- Any dangerous extension in `allowed_extensions`
- `malware_scan.enabled: false` or missing malware scan
- Missing `allowed_mime_types` — extension-only validation is bypassable
