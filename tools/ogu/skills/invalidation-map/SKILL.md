---
name: invalidation-map
description: Compiler skill for the invalidation-map compiler. Activates when producing invalidation-artifact.json. Gates: IV001–IV007. No upstream dependency.
---

# invalidation-map — Compiler Skill

## What This Compiler Does

Compiles the query invalidation map — the explicit declaration of which queries each mutation invalidates. Enforces: no orphan query or mutation references (every key in the map has a corresponding artifact), no circular invalidation chains (mutation → query → mutation), and every mutation maps to at least one query (unless declared fire-and-forget).

**Upstream dependency:** none (cross-checks `query-module` and `mutation-module` artifacts when declared)
**Output artifact:** `invalidation-artifact.json`
**IR identifier:** `INVALIDATION_MAP`

---

## Spec Shape

```json
{
  "map": {
    "useCreateUser":    ["useUsers", "useUserCount"],
    "useUpdateUser":    ["useUser", "useUsers"],
    "useDeleteUser":    ["useUsers", "useUserCount"],
    "useUploadAvatar":  ["useUser"]
  },
  "fireAndForget": ["useLogActivity"],
  "allMutations": ["useCreateUser", "useUpdateUser", "useDeleteUser", "useUploadAvatar", "useLogActivity"],
  "queryArtifacts": {
    "useUsers":     "../../query-modules/useUsers/query-artifact.json",
    "useUser":      "../../query-modules/useUser/query-artifact.json",
    "useUserCount": "../../query-modules/useUserCount/query-artifact.json"
  },
  "mutationArtifacts": {
    "useCreateUser":   "../../mutation-modules/useCreateUser/mutation-artifact.json",
    "useUpdateUser":   "../../mutation-modules/useUpdateUser/mutation-artifact.json",
    "useDeleteUser":   "../../mutation-modules/useDeleteUser/mutation-artifact.json",
    "useUploadAvatar": "../../mutation-modules/useUploadAvatar/mutation-artifact.json"
  }
}
```

### Key Fields

- `map` — required. Object where each key is a mutation hook name and the value is an array of query keys it invalidates.
- `fireAndForget` — optional. Array of mutation names that intentionally invalidate no queries.
- `allMutations` — optional. When declared, every mutation must appear in `map` or `fireAndForget`.
- `queryArtifacts` — optional. Maps query keys to their compiled query-module artifacts.
- `mutationArtifacts` — optional. Maps mutation names to their mutation-module artifacts.
- `queryTriggersMutation` — optional. When declared, circular detection runs: `{ queryX: ["mutationA"] }`.

---

## Gates

### IV001 — spec-valid
Reads `invalidation-spec.json`. Required: `map` (object where each value is an array of query keys).

BAD: `map` missing, or `"useCreateUser": "useUsers"` — value must be array, not string.
GOOD:
```json
{ "map": { "useCreateUser": ["useUsers", "useUserCount"] } }
```

### IV002 — no-orphan-queries
Skipped if `queryArtifacts` not declared. When declared, every query key referenced in `map` values must have a corresponding entry in `queryArtifacts` and that file must exist.

BAD: `map: { "useCreate": ["useNonExistentQuery"] }` — query key not in `queryArtifacts`.
GOOD: All query keys in `map` values appear in `queryArtifacts` with existing artifact files.

### IV003 — no-orphan-mutations
Skipped if `mutationArtifacts` not declared. When declared, every mutation key in `map` must have a corresponding artifact file.

BAD: `map` key `"useCreate"` has no entry in `mutationArtifacts`.
GOOD: All mutation keys have corresponding artifact files.

### IV004 — no-circular
Skipped if `queryTriggersMutation` not declared.

When declared: checks for cycles of the form `mutationA → invalidates queryX → triggers mutationA`.

BAD:
```json
{
  "map": { "useUpdateProfile": ["useProfile"] },
  "queryTriggersMutation": { "useProfile": ["useUpdateProfile"] }
}
// Circular: useUpdateProfile → useProfile → useUpdateProfile
```
GOOD: No mutation invalidates a query that triggers the same mutation.

### IV005 — cross-query
Skipped if `queryArtifacts` not declared. When declared, verifies each referenced artifact was compiled by `query-module` (checks `artifact.compiler === 'query-module'`).

### IV006 — cross-mutation
Skipped if `mutationArtifacts` not declared. When declared:
1. Each artifact must have `compiler === 'mutation-module'`
2. The mutation artifact's own `invalidates_queries` must be a subset of the invalidation map — no undeclared invalidations

BAD: Mutation artifact declares `invalidates_queries: ["useUsers"]` but `invalidation-spec.json` has no such link.
GOOD: Invalidation map and mutation artifacts agree on all invalidation links.

### IV007 — contract-invalidation
Two contract rules:

| Rule | Requirement |
|---|---|
| `allMutations-coverage` | When `spec.allMutations` declared, every mutation must appear in `map` or `fireAndForget` |
| `no-empty-invalidations` | No mutation maps to `[]` unless it's in `spec.fireAndForget` |

BAD: `"useUploadAvatar": []` — maps to 0 queries without being in `fireAndForget`.
GOOD: Either maps to queries, or listed in `fireAndForget`.

---

## What This Compiler Never Forgives

- `invalidation-spec.json` missing (IV001 hard-fails)
- `map` missing or not an object (IV001)
- Map value is not an array (IV001)
- Query key in map not in `queryArtifacts` (IV002)
- Query artifact file not found (IV002)
- Mutation key in map not in `mutationArtifacts` (IV003)
- Circular invalidation chain (IV004)
- Query artifact not compiled by `query-module` (IV005)
- Mutation artifact declares invalidation not in the map (IV006)
- Mutation in `allMutations` not in `map` or `fireAndForget` (IV007)
- Mutation maps to 0 queries without `fireAndForget` declaration (IV007)
