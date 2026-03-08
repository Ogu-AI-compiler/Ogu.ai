---
name: role-privilege-policy
description: Compiler skill for the role-privilege-policy compiler. Activates when producing role-privilege-artifact.json. Gates: RPP001–RPP007. No upstream dependency.
---

# role-privilege-policy — Compiler Skill

## What This Compiler Does

Compiles the PostgreSQL role privilege policy — role types, privilege grants, superuser restrictions, DDL separation, PII row-level security, migration role separation, and analytics read-only enforcement. Enforces: no non-admin superusers, application/analytics roles have no DDL, no wildcard `ALL PRIVILEGES`, PII-accessing roles require RLS, a migration role with CREATE/ALTER exists, and analytics roles have SELECT only.

**Upstream dependency:** none
**Output artifact:** `role-privilege-artifact.json`
**IR identifier:** `ROLE_PRIVILEGE:{project}`

---

## Spec Shape

```json
{
  "roles": [
    {
      "name": "app_user",
      "type": "application",
      "privileges": ["SELECT", "INSERT", "UPDATE", "DELETE"],
      "pii_table_access": true,
      "row_level_security": "required"
    },
    {
      "name": "migration_runner",
      "type": "migration",
      "privileges": ["SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP"]
    },
    {
      "name": "analytics_reader",
      "type": "analytics",
      "privileges": ["SELECT"]
    },
    {
      "name": "reporting_readonly",
      "type": "readonly",
      "privileges": ["SELECT"]
    }
  ],
  "pii_tables": ["users", "payments", "sessions"],
  "has_pii_tables": true
}
```

Required fields:
- `roles` — non-empty array, each with `name`, `type`, `privileges`

Valid role types: `application`, `migration`, `analytics`, `admin`, `readonly`, `replication`

---

## Gates

### RPP001 — spec-valid
Reads `role-privilege-policy.json`. Required: `roles` (non-empty array). Each role needs `name`, `type` (valid), `privileges` (array).

Hard-fails if `role-privilege-policy.json` is missing.

### RPP002 — no-superuser
Only `admin`-type roles may have `superuser: true`, and only with a `justification` field. All other role types (application, analytics, readonly, migration, replication) must not be superusers.

BAD:
```json
{ "name": "app_user", "type": "application", "superuser": true }
// application role as superuser
```
```json
{ "name": "dba", "type": "admin", "superuser": true }
// admin superuser without justification
```
GOOD:
```json
{
  "name": "dba",
  "type": "admin",
  "superuser": true,
  "justification": "Needed for pg_upgrade and extension installation in maintenance windows"
}
```

### RPP003 — no-ddl-privileges
Application and analytics roles must not have DDL privileges: `DROP`, `TRUNCATE`, `ALTER`, `CREATE`. Only `migration` and `admin` types may have DDL access.

Escape: add `@ddl-ok` in the `justification` field with an explanation.

BAD:
```json
{ "name": "app_user", "type": "application", "privileges": ["SELECT", "DROP"] }
// application role with DROP
```
GOOD:
```json
{ "name": "app_user", "type": "application", "privileges": ["SELECT", "INSERT", "UPDATE", "DELETE"] }
```

### RPP004 — no-all-privileges
No role may use `"ALL"`, `"ALL PRIVILEGES"`, or `"*"` as a privilege value. Wildcard grants silently include future PostgreSQL privileges and violate least-privilege principle.

BAD:
```json
{ "privileges": ["ALL PRIVILEGES"] }
{ "privileges": ["ALL"] }
{ "privileges": ["*"] }
```
GOOD:
```json
{ "privileges": ["SELECT", "INSERT", "UPDATE", "DELETE"] }
```

### RPP005 — pii-row-level-security
Skipped if no PII tables are declared (`pii_tables` or `has_pii_tables`). When PII tables exist, any non-migration/non-admin role with `pii_table_access: true` or access to a listed PII table must declare `row_level_security: "required"`.

Without RLS, a single application bug can read ALL rows across all tenants.

BAD:
```json
{
  "name": "app_user",
  "type": "application",
  "pii_table_access": true,
  "row_level_security": "optional"
}
```
GOOD:
```json
{
  "name": "app_user",
  "type": "application",
  "pii_table_access": true,
  "row_level_security": "required"
}
```

### RPP006 — migration-role-separation
At least one `"migration"`-type role must be declared. Migration roles must have `CREATE` and `ALTER` in their privileges. Application roles must NOT have `CREATE` or `ALTER`.

This enforces the invariant: only the migration runner can modify schema structure.

BAD:
```json
{ "roles": [{ "name": "app_user", "type": "application", "privileges": ["SELECT"] }] }
// no migration role — who runs schema migrations?
```
```json
{ "name": "migration_runner", "type": "migration", "privileges": ["SELECT", "INSERT"] }
// migration role without CREATE and ALTER
```
GOOD:
```json
{ "name": "migration_runner", "type": "migration", "privileges": ["CREATE", "ALTER", "SELECT", "INSERT", "UPDATE", "DELETE", "DROP"] }
```

### RPP007 — analytics-readonly
Analytics and readonly roles must have `SELECT` privilege only. Any write privilege (`INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `DROP`, `ALTER`, `CREATE`) on an analytics role creates an unintended data mutation vector.

BAD:
```json
{ "name": "analytics_reader", "type": "analytics", "privileges": ["SELECT", "INSERT"] }
// analytics role with write access
```
GOOD:
```json
{ "name": "analytics_reader", "type": "analytics", "privileges": ["SELECT"] }
```

---

## What This Compiler Never Forgives

- `role-privilege-policy.json` missing (RPP001 hard-fails)
- `roles` missing or empty (RPP001)
- Any role missing `name`, `type`, or `privileges` (RPP001)
- `type` not in valid list (RPP001)
- Non-admin role with `superuser: true` (RPP002)
- Admin superuser without `justification` (RPP002)
- Application/analytics role with `DROP`, `TRUNCATE`, `ALTER`, or `CREATE` (RPP003)
- Any role with `"ALL"`, `"ALL PRIVILEGES"`, or `"*"` privilege (RPP004)
- PII-accessing role without `row_level_security: "required"` (RPP005)
- No migration-type role declared (RPP006)
- Migration role without `CREATE` or `ALTER` (RPP006)
- Application role with `CREATE` or `ALTER` (RPP006)
- Analytics/readonly role with any write privilege (RPP007)
