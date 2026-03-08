# Invalidation Map Compiler — Agent Prompt

You are implementing a cache invalidation map that declares which React Query cache keys are invalidated by which mutations.

## Spec file: `invalidation-spec.json`
```json
{
  "map": {
    "createUser": ["users", "users-list"],
    "updateUser": ["users", "user-detail"],
    "deleteUser": ["users", "users-list", "user-detail"]
  }
}
```

## Gates you must satisfy

| ID | Gate | Rule |
|----|------|------|
| IV001 | spec-valid | invalidation-spec.json must exist with a `map` object |
| IV002 | no-orphan-queries | Every query key in the map must appear in the codebase |
| IV003 | no-orphan-mutations | Every mutation name in the map must appear in the codebase |
| IV004 | no-circular | No mutation A invalidates a query that triggers mutation A |
| IV005 | cross-query | Query keys must be registered in query-artifact.json |
| IV006 | cross-mutation | Mutation names must appear in mutation-artifact.json |
| IV007 | contract-invalidation | Map must be typed, exported, and use queryClient.invalidateQueries |

## Implementation rules

1. The map is **declarative** — it describes what gets invalidated, not how.
2. Each mutation key must match a `useMutation` hook name in the codebase.
3. Each query key must match a `useQuery` key in the codebase.
4. No mutation should indirectly re-trigger itself through query invalidation.

## Files to produce
- `invalidation-map.ts` — typed exported map object
- `invalidation-map.test.ts` — validates map structure and key references
