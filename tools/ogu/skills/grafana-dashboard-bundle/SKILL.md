---
name: grafana-dashboard-bundle
description: Compiler skill for the grafana_dashboard_bundle compiler. Activates when producing grafana-dashboard-artifact.json. Gates: GD001–GD007. No upstream dependency.
---

# grafana-dashboard-bundle — Compiler Skill

## What This Compiler Does

Compiles the Grafana dashboard bundle — dashboard JSON files, UIDs, datasource declarations, panel ID uniqueness, and required metadata. Enforces: each dashboard JSON file exists and is valid JSON, every dashboard has title/panels/schemaVersion, datasource UIDs referenced in panels match declared datasources (or use template variables), no duplicate panel IDs within a dashboard, and all dashboards have `uid` and `tags`.

**Upstream dependency:** none
**Output artifact:** `grafana-dashboard-artifact.json`
**IR identifier:** `GRAFANA_DASHBOARD:{project}`

---

## Spec Shape

```json
{
  "dashboards": [
    { "file": "dashboards/api-overview.json", "uid": "api-overview-v1" },
    { "file": "dashboards/error-rates.json", "uid": "error-rates-v1" }
  ],
  "datasources": [
    { "uid": "prometheus-prod", "type": "prometheus" },
    { "uid": "loki-prod", "type": "loki" }
  ]
}
```

Required fields:
- `dashboards` — non-empty array, each with `file` and `uid`

---

## Gates

### GD001 — spec-valid
Reads `grafana-dashboard-spec.json`. Required: `dashboards` (non-empty array). Each dashboard entry must have `file` and `uid`.

Hard-fails if `grafana-dashboard-spec.json` is missing.

### GD002 — dashboard-json-valid
Each `dashboard.file` must exist on disk and be valid JSON. A referenced but missing dashboard file is a broken reference.

BAD: `"file": "dashboards/api.json"` but file doesn't exist.
BAD: File exists but contains invalid JSON.
GOOD: All referenced files exist and parse as valid JSON.

### GD003 — required-fields-present
Each dashboard JSON must contain:
- `title` — dashboard display name
- `panels` — array (can be empty but must be declared)
- `schemaVersion` — Grafana schema version number

BAD:
```json
{ "uid": "my-dash", "panels": [] }
// missing title and schemaVersion
```
GOOD:
```json
{ "title": "API Overview", "panels": [], "schemaVersion": 38, "uid": "api-overview-v1" }
```

### GD004 — datasource-uids-declared
Skipped if `spec.datasources` is not declared. When declared, UIDs referenced inside dashboard JSON panels must appear in `spec.datasources`. Template variable references (`${DS_PROMETHEUS}`, `${DS_*}`) are exempt.

BAD:
```json
// spec declares: { "datasources": [{ "uid": "prometheus-prod", "type": "prometheus" }] }
// dashboard JSON references: { "datasource": { "uid": "mystery-datasource" } }
// mystery-datasource not in spec.datasources
```
GOOD: All UID references in panel JSON match declared datasource UIDs, or use `${DS_*}` template syntax.

### GD005 — panel-ids-unique
Within each dashboard JSON, no two panels may share the same `id`. Duplicate panel IDs cause Grafana to silently drop panels or behave unpredictably.

BAD:
```json
{ "panels": [{ "id": 1, "type": "graph" }, { "id": 1, "type": "stat" }] }
// duplicate panel id 1
```
GOOD: All panel `id` values are unique within each dashboard.

### GD006 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### GD007 — contract-dashboard
Final contract checks:
- `spec.datasources` must be declared with `uid` and `type` per entry
- Each dashboard JSON must have a top-level `uid` field
- Each dashboard JSON must have a `tags` array

BAD:
```json
// dashboard JSON missing uid and tags:
{ "title": "API Stats", "panels": [], "schemaVersion": 38 }
```
GOOD:
```json
{
  "title": "API Stats",
  "uid": "api-stats-v1",
  "tags": ["api", "production"],
  "panels": [],
  "schemaVersion": 38
}
```

---

## What This Compiler Never Forgives

- `grafana-dashboard-spec.json` missing (GD001 hard-fails)
- `dashboards` missing or empty (GD001)
- Any dashboard entry missing `file` or `uid` (GD001)
- Referenced dashboard JSON file doesn't exist (GD002)
- Dashboard JSON file is not valid JSON (GD002)
- Dashboard JSON missing `title`, `panels`, or `schemaVersion` (GD003)
- Panel datasource UID not in `spec.datasources` (GD004)
- Duplicate panel IDs within a dashboard (GD005)
- `spec.datasources` not declared (GD007)
- Dashboard JSON missing top-level `uid` (GD007)
- Dashboard JSON missing `tags` array (GD007)
