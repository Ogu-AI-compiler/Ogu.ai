---
name: helm-chart
description: Compiler skill for the helm_chart compiler. Activates when producing helm-chart-artifact.json. Gates: HC001–HC008. No upstream dependency.
---

# helm-chart — Compiler Skill

## What This Compiler Does

Compiles the Helm chart specification and validates the actual chart files — Chart.yaml, values.yaml, template rendering, unresolved template expressions, values coverage, and required metadata. Enforces: Chart.yaml exists with name/version/apiVersion, values.yaml is non-empty, templates render without error, no TODO/PLACEHOLDER expressions in templates, all `.Values.key` references have entries in values.yaml, and maintainers + description are declared.

**Upstream dependency:** none
**Output artifact:** `helm-chart-artifact.json`
**IR identifier:** `HELM_CHART:{project}`

---

## Spec Shape

```json
{
  "chartName": "my-service",
  "version": "1.2.3",
  "appVersion": "2024.11.1",
  "description": "Helm chart for my-service API",
  "maintainers": [
    { "name": "Platform Team", "email": "platform@example.com" }
  ]
}
```

Required fields:
- `chartName` — chart name (must match Chart.yaml `name`)
- `version` — chart version (semver)
- `appVersion` — application version

Also requires on disk:
- `Chart.yaml` — with `name`, `version`, `apiVersion` fields
- `values.yaml` — non-empty YAML

---

## Gates

### HC001 — spec-valid
Reads `helm-chart-spec.json`. Required: `chartName`, `version`, `appVersion`.

Hard-fails if `helm-chart-spec.json` is missing.

### HC002 — chart-yaml-valid
`Chart.yaml` must exist in the directory and contain:
- `name` — chart name
- `version` — semver string
- `apiVersion` — should be `"v2"` for Helm 3 charts

BAD: `Chart.yaml` missing.
BAD: `apiVersion: v1` — Helm 2 chart format.
GOOD:
```yaml
apiVersion: v2
name: my-service
version: 1.2.3
description: My service chart
```

### HC003 — values-yaml-valid
`values.yaml` must exist and be non-empty. An empty values file means all template values are unset at install time.

BAD: `values.yaml` missing or empty.
GOOD: `values.yaml` with at least one key defined.

### HC004 — templates-render
Helm templates in the `templates/` directory must render without errors (using `helm template` or equivalent dry-run). Syntax errors in templates fail at install time with cryptic Kubernetes API errors.

### HC005 — no-unresolved-expressions
Template files are scanned for:
- Empty `{{ }}` expressions
- `TODO`, `PLACEHOLDER`, `YOUR_*` patterns
- Bare `ALL_CAPS` identifiers without dots (likely forgot `$.Values.` prefix)
- `REPLACE_ME` markers

BAD:
```yaml
image: {{ }}   # empty expression
host: YOUR_HOSTNAME_HERE
password: REPLACE_ME
```
GOOD:
```yaml
image: {{ .Values.image.repository }}:{{ .Values.image.tag }}
host: {{ .Values.ingress.host }}
```

### HC006 — values-coverage
All `.Values.key` references in template files must have a corresponding top-level entry in `values.yaml`. Missing values cause template render failures at install time.

BAD:
```yaml
# templates/deployment.yaml references:
image: {{ .Values.image.repository }}
# but values.yaml has no "image" key
```
GOOD: Every `.Values.key` used in templates has an entry in `values.yaml`.

### HC007 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### HC008 — contract-chart
Final contract checks:
- `maintainers` list must be declared (in spec or Chart.yaml) with at least one entry
- `description` must be declared (in spec or Chart.yaml)

BAD:
```yaml
# Chart.yaml:
apiVersion: v2
name: my-service
version: 1.2.3
# no description, no maintainers
```
GOOD:
```yaml
apiVersion: v2
name: my-service
version: 1.2.3
description: Helm chart for my-service API
maintainers:
  - name: Platform Team
    email: platform@example.com
```

---

## What This Compiler Never Forgives

- `helm-chart-spec.json` missing (HC001 hard-fails)
- `chartName`, `version`, or `appVersion` missing (HC001)
- `Chart.yaml` missing from directory (HC002)
- `Chart.yaml` missing `name`, `version`, or `apiVersion` (HC002)
- `values.yaml` missing or empty (HC003)
- Templates fail to render (HC004)
- Empty `{{ }}` expressions in templates (HC005)
- `TODO`/`PLACEHOLDER`/`YOUR_*`/`REPLACE_ME` in templates (HC005)
- `.Values.key` reference without entry in `values.yaml` (HC006)
- No `maintainers` declared (HC008)
- No `description` declared (HC008)
