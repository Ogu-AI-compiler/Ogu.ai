---
name: cost-tagging-policy
description: Compiler skill for the cost_tagging_policy compiler. Activates when producing cost-tagging-artifact.json. Gates: CT001–CT007. No upstream dependency.
---

# cost-tagging-policy — Compiler Skill

## What This Compiler Does

Compiles the cloud cost tagging policy — required tags, value constraints, resource type coverage, and enforcement mode. Enforces: all required tags have key and description, common billing tags are covered (team/service/environment/cost-center/project/owner), tag key/value formats are valid, resource types cover compute/storage/network, enforcement mode is set, and enforce mode requires targets.

**Upstream dependency:** none
**Output artifact:** `cost-tagging-artifact.json`
**IR identifier:** `COST_TAGGING:{project}`

---

## Spec Shape

```json
{
  "organization": "acme-corp",
  "requiredTags": [
    { "key": "team", "description": "Owning team name", "allowedValues": ["platform", "backend", "frontend"] },
    { "key": "service", "description": "Service or application name" },
    { "key": "environment", "description": "Deployment environment", "allowedValues": ["prod", "staging", "dev"] },
    { "key": "cost-center", "description": "Finance cost center code" },
    { "key": "project", "description": "Project or product name" },
    { "key": "owner", "description": "On-call owner (email or team)" }
  ],
  "resourceTypes": ["compute", "storage", "network", "database"],
  "enforcementMode": "enforce",
  "enforcementTargets": ["aws_instance", "aws_s3_bucket", "aws_rds_instance"]
}
```

Required fields:
- `organization` — string
- `requiredTags` — non-empty array, each with `key` and `description`

---

## Gates

### CT001 — spec-valid
Reads `cost-tagging-spec.json`. Required: `organization`, `requiredTags` (non-empty array). Each tag must have `key` and `description`.

Hard-fails if `cost-tagging-spec.json` is missing.

### CT002 — required-tags-defined
Common billing tags must be covered: `team`, `service`, `environment`, `cost-center`, `project`, `owner`. Missing any of these means finance cannot allocate costs by team, service, or environment.

Escape: set `skipBillingTagCheck: true` if your org uses different canonical names.

BAD:
```json
{ "requiredTags": [{ "key": "app", "description": "App name" }] }
// missing team, environment, cost-center, project, owner
```
GOOD:
```json
{ "requiredTags": [
  { "key": "team", "description": "Owning team" },
  { "key": "service", "description": "Service name" },
  { "key": "environment", "description": "Env name" },
  { "key": "cost-center", "description": "Finance code" },
  { "key": "project", "description": "Project name" },
  { "key": "owner", "description": "On-call owner" }
]}
```

### CT003 — tag-values-valid
Tag keys must match: `[a-zA-Z0-9_\-:/.]{1,128}`.
Tag values (if declared as `allowedValues`) must each match: `[a-zA-Z0-9_\-:/.@]{0,256}`.
`defaultValue` must be one of the declared `allowedValues`.

BAD:
```json
{ "key": "cost center", "allowedValues": ["team A"] }
// spaces not allowed in keys or values
```
GOOD:
```json
{ "key": "cost-center", "allowedValues": ["team-a", "team-b"] }
```

### CT004 — resource-types-covered
Skipped if `resourceTypes` is not declared. When declared, must include at least one entry from each category:
- Compute: `compute`, `instance`, `vm`, `ec2`, `gce`
- Storage: `storage`, `s3`, `gcs`, `blob`
- Network: `network`, `vpc`, `subnet`, `loadbalancer`

Escape: `skipResourceTypeCoverage: true`.

### CT005 — enforcement-mode-set
`enforcementMode` must be declared and one of: `audit`, `enforce`, `warn`.

BAD:
```json
{}
// no enforcementMode — tagging policy is decorative
```
GOOD:
```json
{ "enforcementMode": "enforce" }
```

### CT006 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### CT007 — contract-tagging
Final contract checks:
- No duplicate tag keys in `requiredTags`
- `enforcementMode: "enforce"` requires `enforcementTargets` to be declared (a list of resource types to enforce on)

BAD:
```json
{
  "enforcementMode": "enforce"
}
// no enforcementTargets — enforce mode with no targets is a no-op
```
GOOD:
```json
{
  "enforcementMode": "enforce",
  "enforcementTargets": ["aws_instance", "aws_s3_bucket"]
}
```

---

## What This Compiler Never Forgives

- `cost-tagging-spec.json` missing (CT001 hard-fails)
- `organization` or `requiredTags` missing (CT001)
- `requiredTags` empty (CT001)
- Any tag missing `key` or `description` (CT001)
- Common billing tags (team/service/environment/cost-center/project/owner) not covered without `skipBillingTagCheck` (CT002)
- Tag key with spaces or invalid characters (CT003)
- `defaultValue` not in `allowedValues` (CT003)
- `enforcementMode` not declared (CT005)
- `enforcementMode` not one of audit/enforce/warn (CT005)
- Duplicate tag keys (CT007)
- `enforcementMode: "enforce"` without `enforcementTargets` (CT007)
