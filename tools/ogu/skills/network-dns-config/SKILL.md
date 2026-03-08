---
name: network-dns-config
description: Compiler skill for the network_dns_config compiler. Activates when producing dns-config-artifact.json. Gates: DNS001–DNS008. No upstream dependency.
---

# network-dns-config — Compiler Skill

## What This Compiler Does

Compiles the DNS configuration specification — records, TTLs, FQDN validation, and ownership metadata. Enforces: all hostnames are valid FQDNs, TTLs are explicitly declared (no reliance on zone defaults), environment and owner fields are declared for governance, and no conflicting record types for the same name.

**Upstream dependency:** none
**Output artifact:** `dns-config-artifact.json`
**IR identifier:** `DNS_CONFIG:{project}`

---

## Spec Shape

```json
{
  "zone": "example.com",
  "environment": "production",
  "owner": "platform-team",
  "records": [
    { "name": "api.example.com", "type": "A", "value": "10.0.1.100", "ttl": 300 },
    { "name": "www.example.com", "type": "CNAME", "value": "api.example.com", "ttl": 3600 },
    { "name": "example.com", "type": "MX", "value": "mail.example.com", "priority": 10, "ttl": 3600 }
  ]
}
```

Required fields:
- `zone` — DNS zone name
- `records` — non-empty array, each with `name`, `type`, `value`

---

## Gates

### DNS001 — spec-valid
Reads `dns-config-spec.json`. Required: `zone`, `records` (non-empty array). Each record needs `name`, `type`, `value`.

Hard-fails if `dns-config-spec.json` is missing.

### DNS002 — hostnames-valid
All `name` values in records must be valid FQDNs. Validates:
- Correct label format (alphanumeric, hyphens)
- No leading or trailing hyphens on labels
- Labels no longer than 63 characters
- Total FQDN no longer than 253 characters
- At least one dot (unless it's a zone apex)

BAD:
```json
{ "name": "my service" }
{ "name": "-invalid.example.com" }
{ "name": "192.168.1.1" }
```
GOOD:
```json
{ "name": "api.example.com" }
{ "name": "_dmarc.example.com" }
```

### DNS003 — record-types-valid
`type` must be a recognized DNS record type: `A`, `AAAA`, `CNAME`, `MX`, `TXT`, `NS`, `PTR`, `SRV`, `SOA`, `CAA`, `ALIAS`, `ANAME`.

BAD:
```json
{ "type": "IP4" }
```
GOOD:
```json
{ "type": "A" }
```

### DNS004 — no-conflicting-records
A hostname cannot have both a `CNAME` record and any other record type. CNAME is an alias — it cannot coexist with A, MX, or other records at the same name.

BAD:
```json
[
  { "name": "api.example.com", "type": "CNAME", "value": "lb.example.com" },
  { "name": "api.example.com", "type": "A", "value": "10.0.1.100" }
]
// CNAME + A at same name
```
GOOD: CNAME records are the only record at their hostname.

### DNS005 — ttl-explicit
Every record must declare an explicit `ttl` value. Relying on zone default TTLs makes the configuration non-portable and unpredictable across providers.

BAD:
```json
{ "name": "api.example.com", "type": "A", "value": "10.0.1.100" }
// no ttl
```
GOOD:
```json
{ "name": "api.example.com", "type": "A", "value": "10.0.1.100", "ttl": 300 }
```

### DNS006 — mx-has-priority
MX records must declare a `priority` field. Without priority, mail routing order is undefined.

BAD:
```json
{ "type": "MX", "value": "mail.example.com" }
// no priority
```
GOOD:
```json
{ "type": "MX", "value": "mail.example.com", "priority": 10 }
```

### DNS007 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### DNS008 — contract-dns
Final contract checks:
- `environment` must be declared — DNS records without environment context cannot be managed safely across envs
- `owner` must be declared — orphaned DNS records accumulate without a responsible team

BAD:
```json
{ "zone": "example.com", "records": [...] }
// no environment, no owner
```
GOOD:
```json
{
  "zone": "example.com",
  "environment": "production",
  "owner": "platform-team",
  "records": [...]
}
```

---

## What This Compiler Never Forgives

- `dns-config-spec.json` missing (DNS001 hard-fails)
- `zone` or `records` missing (DNS001)
- `records` empty (DNS001)
- Any record missing `name`, `type`, or `value` (DNS001)
- Invalid FQDN hostname (DNS002)
- `type` not in recognized DNS record types (DNS003)
- CNAME coexisting with another record type at the same name (DNS004)
- Any record missing explicit `ttl` (DNS005)
- MX record without `priority` (DNS006)
- `environment` not declared (DNS008)
- `owner` not declared (DNS008)
