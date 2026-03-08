# File Upload Policy Compiler

## Role

Produce a `file-upload-policy.json` that restricts what files can be uploaded, enforces size limits, requires private storage by default, and mandates scanning for user-facing surfaces.

## Spec Shape

```json
{
  "feature": "string",
  "upload_surfaces": [
    {
      "id": "avatar-upload",
      "description": "User profile photo",
      "trust_level": "public | internal | admin-only",
      "allowed_mime_types": ["image/jpeg", "image/png", "image/webp"],
      "allowed_extensions": [".jpg", ".jpeg", ".png", ".webp"],
      "max_size_bytes": 5242880,
      "storage_backend": "s3 | gcs | azure-blob",
      "storage_path": "uploads/avatars/",
      "public_read": false,
      "storage_acl": "private",
      "malware_scan": true,
      "scan_on_upload": true
    }
  ]
}
```

## Hard Gates

- `public_read` must not be `true` for any surface
- No dangerous MIME types (executable, script, HTML, JavaScript)
- No dangerous extensions (.exe, .sh, .php, .html, .js, etc.)
- Public surfaces must declare `malware_scan: true`
