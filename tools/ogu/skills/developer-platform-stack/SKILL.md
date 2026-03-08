---
name: developer-platform-stack
description: Compiler skill for the developer_platform_stack compiler. Activates when producing dev-platform-artifact.json. Gates: DP001–DP007. No upstream dependency.
---

# developer-platform-stack — Compiler Skill

## What This Compiler Does

Compiles the internal developer platform (IDP) stack specification — platform components, golden paths, IDP integration, SBOM coverage, and self-service catalog. Enforces: all component types are from the allowlist, golden paths are defined with steps, an IDP component with a tool is declared, SBOM coverage is declared, and core components (source-control, ci-cd, artifact-registry) are all present.

**Upstream dependency:** none
**Output artifact:** `dev-platform-artifact.json`
**IR identifier:** `DEV_PLATFORM:{project}`

---

## Spec Shape

```json
{
  "name": "acme-developer-platform",
  "components": [
    { "type": "source-control", "tool": "github" },
    { "type": "ci-cd", "tool": "github-actions" },
    { "type": "artifact-registry", "tool": "ecr" },
    { "type": "secret-manager", "tool": "vault" },
    { "type": "idp", "tool": "backstage" },
    { "type": "observability", "tool": "datadog" },
    { "type": "sbom", "tool": "syft" },
    { "type": "gitops", "tool": "argocd" }
  ],
  "goldenPaths": [
    {
      "name": "new-microservice",
      "steps": [
        "Create repo from template",
        "Run ogu init",
        "Configure CI/CD",
        "Deploy to staging"
      ]
    }
  ]
}
```

Required fields:
- `name` — platform name
- `components` — non-empty array, each with `type`

---

## Gates

### DP001 — spec-valid
Reads `dev-platform-spec.json`. Required: `name`, `components` (non-empty array). Each component must have `type`.

Hard-fails if `dev-platform-spec.json` is missing.

### DP002 — components-known
Every component `type` must be from the allowlist:
`source-control`, `ci-cd`, `artifact-registry`, `secret-manager`, `idp`, `api-gateway`, `service-mesh`, `observability`, `feature-flags`, `developer-portal`, `local-dev`, `gitops`, `code-review`, `dependency-scanning`, `sbom`, `iac-automation`, `platform-api`, `self-service-catalog`, `cost-attribution`, `oncall`.

BAD:
```json
{ "components": [{ "type": "ticket-tracker" }] }
// not in allowlist
```
GOOD:
```json
{ "components": [{ "type": "source-control", "tool": "github" }] }
```

### DP003 — golden-paths-defined
`goldenPaths` must be declared with at least one path. Each path needs `name` and a non-empty `steps` array. Golden paths are the "paved road" — the standard way to create new services, deploy changes, or onboard developers.

Escape: `skipGoldenPaths: true`.

BAD:
```json
{ "name": "my-platform", "components": [...] }
// no goldenPaths — developers have no standard workflow
```
GOOD:
```json
{
  "goldenPaths": [{
    "name": "new-service",
    "steps": ["Clone template", "Run init", "Configure CI", "Deploy"]
  }]
}
```

### DP004 — idp-integrated
A component with `type: "idp"` must be present and have a `tool` declared (e.g., `backstage`, `cortex`, `port`). Without an IDP, developers have no self-service portal for service catalog, documentation, or scaffolding.

Escape: `skipIDPCheck: true`.

BAD:
```json
{ "components": [{ "type": "source-control", "tool": "github" }] }
// no idp component
```
GOOD:
```json
{ "components": [{ "type": "idp", "tool": "backstage" }] }
```

### DP005 — sbom-coverage
A component with `type: "sbom"` must be present. SBOM (Software Bill of Materials) is required for supply chain security compliance.

Escape: `skipSBOM: true`.

BAD:
```json
{ "components": [{ "type": "ci-cd", "tool": "github-actions" }] }
// no sbom component
```
GOOD:
```json
{ "components": [{ "type": "sbom", "tool": "syft" }] }
```

### DP006 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### DP007 — contract-platform
Final contract checks:
- `source-control`, `ci-cd`, and `artifact-registry` components must all be present — these are the minimum viable platform
- No duplicate component types unless the component has `multi: true`

BAD:
```json
{ "components": [{ "type": "idp", "tool": "backstage" }] }
// missing source-control, ci-cd, artifact-registry
```
GOOD:
```json
{ "components": [
  { "type": "source-control", "tool": "github" },
  { "type": "ci-cd", "tool": "github-actions" },
  { "type": "artifact-registry", "tool": "ecr" }
]}
```

---

## What This Compiler Never Forgives

- `dev-platform-spec.json` missing (DP001 hard-fails)
- `name` or `components` missing (DP001)
- `components` empty (DP001)
- Any component `type` not in allowlist (DP002)
- `goldenPaths` not declared without `skipGoldenPaths` (DP003)
- Any golden path missing `name` or `steps` (DP003)
- No `idp` component without `skipIDPCheck` (DP004)
- `idp` component without `tool` field (DP004)
- No `sbom` component without `skipSBOM` (DP005)
- `source-control`, `ci-cd`, or `artifact-registry` missing (DP007)
- Duplicate component types without `multi: true` (DP007)
