---
name: kustomize-overlay
description: Compiler skill for the kustomize_overlay compiler. Activates when producing kustomize-artifact.json. Gates: KO001–KO007. No upstream dependency.
---

# kustomize-overlay — Compiler Skill

## What This Compiler Does

Compiles the Kustomize overlay specification — base reference, environment, patches, namespace, and image tag policy. Enforces: `kustomization.yaml` exists with resources/bases/components, patches have `target.kind`, no duplicate resources across base and overlay, namespace matches environment name, and image tag policy is declared.

**Upstream dependency:** none
**Output artifact:** `kustomize-artifact.json`
**IR identifier:** `KUSTOMIZE_OVERLAY:{project}`

---

## Spec Shape

```json
{
  "base": "../../base",
  "environment": "production",
  "namespaceOverride": "production",
  "imageTagPolicy": "semver",
  "patches": [
    {
      "target": { "kind": "Deployment", "name": "api" },
      "patch": [{ "op": "replace", "path": "/spec/replicas", "value": 5 }]
    }
  ]
}
```

Required fields:
- `base` — path to the Kustomize base
- `environment` — target environment name

Also requires on disk:
- `kustomization.yaml` with `resources`, `bases`, or `components` field

---

## Gates

### KO001 — spec-valid
Reads `kustomize-spec.json`. Required: `base`, `environment`.

Hard-fails if `kustomize-spec.json` is missing.

### KO002 — kustomization-valid
`kustomization.yaml` must exist in the directory and contain at least one of: `resources`, `bases`, or `components`. Without one of these, Kustomize has nothing to build.

BAD: `kustomization.yaml` missing or empty.
BAD:
```yaml
# kustomization.yaml with no resources
namespace: production
```
GOOD:
```yaml
resources:
  - ../../base
namePrefix: prod-
namespace: production
```

### KO003 — patches-resolve
Each patch with a `target` must have `target.kind` declared. Patches without a kind match every resource in the overlay — an unintended broad patch.

BAD:
```json
{ "patches": [{ "target": { "name": "api" }, "patch": [...] }] }
// no target.kind — matches all resources named "api"
```
GOOD:
```json
{ "patches": [{ "target": { "kind": "Deployment", "name": "api" }, "patch": [...] }] }
```

### KO004 — no-duplicate-resources
Resources declared in the overlay must not duplicate resources already declared in the base. Duplicate resources cause Kustomize to fail with a merge conflict error.

### KO005 — namespace-matches-env
When `namespaceOverride` is declared, it must contain the `environment` name as a substring. A production overlay with a staging namespace is a configuration error.

Escape: `allowNamespaceMismatch: true`.

BAD:
```json
{ "environment": "production", "namespaceOverride": "staging" }
// namespace doesn't contain "production"
```
GOOD:
```json
{ "environment": "production", "namespaceOverride": "production" }
{ "environment": "staging", "namespaceOverride": "my-app-staging" }
```

### KO006 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### KO007 — contract-kustomize
Final contract check:
- `imageTagPolicy` must be declared: `digest`, `semver`, or `latest-allowed`

The `latest-allowed` value must be used intentionally — it is the only way to allow mutable tags in an overlay.

BAD:
```json
{ "base": "../../base", "environment": "production" }
// no imageTagPolicy
```
GOOD:
```json
{ "imageTagPolicy": "semver" }
```

---

## What This Compiler Never Forgives

- `kustomize-spec.json` missing (KO001 hard-fails)
- `base` or `environment` missing (KO001)
- `kustomization.yaml` missing from directory (KO002)
- `kustomization.yaml` has no `resources`, `bases`, or `components` (KO002)
- Patch with `target` but no `target.kind` (KO003)
- Duplicate resources between base and overlay (KO004)
- `namespaceOverride` doesn't contain `environment` name without `allowNamespaceMismatch` (KO005)
- `imageTagPolicy` not declared (KO007)
- `imageTagPolicy` not `digest`/`semver`/`latest-allowed` (KO007)
