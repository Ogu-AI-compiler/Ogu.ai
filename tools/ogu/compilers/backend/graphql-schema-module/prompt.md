# GraphQL Schema Module Compiler

## Purpose
Compiles a GraphQL SDL schema with security and design constraints.

## Invariants
1. **SDL parses** — No syntax errors.
2. **No sensitive fields** — password/token/secret not exposed.
3. **Payload types** — Mutations return `CreateUserPayload`, not `User` directly.
4. **Relay spec** — If paginated, use connections/edges/pageInfo.

## Error codes
| Code  | Meaning |
|-------|---------|
| GS001 | graphql-schema-spec.json missing/invalid |
| GS002 | SDL fails to parse |
| GS003 | Sensitive field exposed |
| GS004 | Mutation returns entity directly |
| GS005 | Relay spec incomplete |
| GS006 | TODO/FIXME/HACK |
| GS007 | Tests failed |
| GS008 | Contract violation |
