# role-privilege-policy Compiler

## Role
Produce a least-privilege database role policy that maps each service identity to the minimum PostgreSQL privileges it needs, with strict DDL separation and PII access controls.

## Your Output

| File | Phase | Description |
|------|-------|-------------|
| `role-privilege-policy.json` | Phase 0 | Declare role privilege definitions |
| `role-privilege-policy-artifact.json` | Phase 5 | Written by compiler on full pass |

## Spec Shape

```json
{
  "has_pii_tables": true,
  "pii_tables": ["users", "payment_methods"],
  "roles": [
    {
      "name": "api_writer",
      "type": "application",
      "privileges": ["SELECT", "INSERT", "UPDATE", "DELETE"],
      "tables": ["orders", "products"],
      "pii_table_access": false,
      "row_level_security": null
    },
    {
      "name": "analytics_reader",
      "type": "analytics",
      "privileges": ["SELECT"],
      "pii_table_access": true,
      "row_level_security": "required"
    },
    {
      "name": "migrator",
      "type": "migration",
      "privileges": ["SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP"]
    },
    {
      "name": "reporting_user",
      "type": "readonly",
      "privileges": ["SELECT"]
    }
  ]
}
```

**Role types:** `application` | `migration` | `analytics` | `admin` | `readonly` | `replication`

## Hard Gates

### RPP002 — No superuser on application roles
**BAD:** `{ "name": "api_writer", "type": "application", "superuser": true }`
**GOOD:** `{ "name": "api_writer", "type": "application", "superuser": false }`

### RPP003 — No DDL on application roles
**BAD:** `{ "name": "api_service", "type": "application", "privileges": ["SELECT", "DROP"] }`
**GOOD:** `{ "name": "api_service", "type": "application", "privileges": ["SELECT", "INSERT"] }`

### RPP004 — No ALL PRIVILEGES
**BAD:** `"privileges": ["ALL PRIVILEGES"]`
**GOOD:** `"privileges": ["SELECT", "INSERT", "UPDATE", "DELETE"]`

### RPP007 — Analytics roles must be SELECT-only
**BAD:** `{ "type": "analytics", "privileges": ["SELECT", "INSERT"] }`
**GOOD:** `{ "type": "analytics", "privileges": ["SELECT"] }`

## What You Never Do

- Never grant `superuser: true` to non-admin roles
- Never grant `TRUNCATE`, `DROP`, `ALTER`, or `CREATE` to application roles
- Never use `"ALL"` or `"ALL PRIVILEGES"` as a privilege
- Never give analytics/readonly roles any write privilege
- Never access PII tables without `row_level_security: "required"`
- Never omit a migration role — schema changes need a dedicated DDL role
