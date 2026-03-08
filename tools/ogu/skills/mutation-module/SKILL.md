---
name: mutation-module
description: Compiler skill for the mutation-module compiler. Activates when producing mutation-artifact.json. Gates: MU001–MU013. Upstream: optionally route-artifact.json, query-artifact.json.
---

# mutation-module — Compiler Skill

## What This Compiler Does

Compiles a TanStack Query mutation hook. Write operations only — POST, PUT, PATCH, DELETE. Enforces typed generics, error handler, cache invalidation in `onSuccess`, and rollback in `onError` when optimistic updates are used. No `setState` in mutation callbacks — use query cache instead.

**Upstream dependency:** optionally `route-artifact.json`, `query-artifact.json`
**Output artifact:** `mutation-artifact.json`
**IR identifier:** `MUTATION:{hookName}`

---

## Spec Shape

```json
{
  "hookName": "useCreateUser",
  "endpoint": "/api/users",
  "method": "POST",
  "payloadType": "CreateUserInput",
  "responseType": "User",
  "invalidates": ["users"],
  "optimistic": false
}
```

`hookName` — must start with `use`.
`endpoint` — API path.
`method` — **POST, PUT, PATCH, or DELETE** only. GET/HEAD belong in query-module.
`payloadType` — TypeScript type of the mutation input.
`responseType` — TypeScript type of the response.
`invalidates` — query keys to invalidate on success.
`optimistic` — boolean. When `true`, rollback gates become strict.
`noInvalidation` — optional boolean. Set to `true` to skip the invalidation check (fire-and-forget mutations).

---

## Gates

### MU001 — spec-valid
Reads `mutation-spec.json`. Fails if missing or invalid JSON.

Required fields: `hookName`, `endpoint`, `method`, `payloadType`.

`method` must be POST, PUT, PATCH, or DELETE. GET/HEAD belong in query-module.

BAD: `"method": "GET"` — use query-module. Missing `payloadType`.
GOOD:
```json
{
  "hookName": "useDeleteUser",
  "endpoint": "/api/users/:id",
  "method": "DELETE",
  "payloadType": "{ id: string }"
}
```

### MU005 — invalidation-check
Skipped if `spec.noInvalidation: true`.

After a write, related queries must be invalidated so the UI reflects the change. The mutation hook must call `queryClient.invalidateQueries(...)` or `queryClient.setQueryData(...)` inside the `onSuccess` callback.

The gate also checks that the invalidation is *inside* `onSuccess`, not just floating in the file.

BAD:
```ts
const mutation = useMutation({
  mutationFn: createUser,
  // onSuccess missing — cache never updates after create
});
```
GOOD:
```ts
const mutation = useMutation({
  mutationFn: createUser,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: userQueryKeys.all });
  },
});
```

### MU006 — optimistic-valid
Skipped if `onMutate:` is not used.

When optimistic updates are implemented (`onMutate:` present), `onError` must receive a `context` parameter and call `queryClient.setQueryData(...)` to restore the previous state on failure.

BAD (optimistic without rollback):
```ts
useMutation({
  onMutate: async (newUser) => {
    queryClient.setQueryData(userKeys.detail(newUser.id), newUser);
    // no context returned — onError can't rollback
  },
  onError: (err) => { toast.error('Failed'); }, // context missing — no rollback
});
```
GOOD:
```ts
useMutation({
  onMutate: async (newUser) => {
    await queryClient.cancelQueries({ queryKey: userKeys.detail(newUser.id) });
    const previous = queryClient.getQueryData(userKeys.detail(newUser.id));
    queryClient.setQueryData(userKeys.detail(newUser.id), newUser);
    return { previous }; // context for rollback
  },
  onError: (err, variables, context) => {
    queryClient.setQueryData(userKeys.detail(variables.id), context?.previous); // rollback
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: userKeys.all });
  },
});
```

### MU007 — error-handler
At least one of:
- `onError:` callback in the `useMutation` call
- Typed error generic: `useMutation<Response, ApiError, Variables>` (caller handles errors via `mutation.error`)

BAD:
```ts
const mutation = useMutation({ mutationFn: createUser }); // no error handling
```
GOOD:
```ts
const mutation = useMutation<User, ApiError, CreateUserInput>({
  mutationFn: createUser,
  onError: (error) => {
    toast.error(error.message);
  },
});
```

### MU013 — contract-mutation
Five contract rules:

| Rule | Requirement |
|---|---|
| `typed-generics` | `useMutation<ResponseType, ...>` — typed first generic required |
| `on-error-handler` | `onError:` present OR typed error in generics |
| `invalidates-on-success` | `onSuccess` must call `invalidateQueries` or `setQueryData` |
| `no-direct-state` | `onSuccess` must not call `setState(` or `dispatch(` — use query cache |
| `typed-variables` | Variables typed: `useMutation<R, E, Variables>` or `Variables`/`Payload`/`Input` type referenced |

BAD (direct state in onSuccess):
```ts
useMutation({
  mutationFn: createUser,
  onSuccess: (newUser) => {
    setUsers(prev => [...prev, newUser]); // BAD — bypasses query cache
  },
});
```
GOOD:
```ts
useMutation<User, ApiError, CreateUserInput>({
  mutationFn: createUser,
  onError: (error) => toast.error(error.message),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: userQueryKeys.all }); // query cache
  },
});
```

### naming-valid / cross-route / cross-query / no-any / ts-valid / coverage / tests-pass / no-todos
- **naming-valid**: hook name starts with `use`
- **cross-route**: if `routeArtifact` set, endpoint/method must match
- **cross-query**: if query artifact exists, invalidation keys should align with known query keys
- **no-any**: `: any`, `as any` blocked
- **ts-valid**: `tsc --noEmit` must pass
- **coverage**: ≥80% statement coverage
- **tests-pass**: hard-fails if no test files; vitest or jest must pass
- **no-todos**: `TODO`, `FIXME`, `HACK`, `XXX` blocked

---

## What This Compiler Never Forgives

- `mutation-spec.json` missing (MU001 hard-fails)
- `method` is GET/HEAD — use query-module (MU001)
- Missing `payloadType` (MU001)
- No `queryClient.invalidateQueries` or `setQueryData` in `onSuccess` (unless `noInvalidation: true`) (MU005)
- `onMutate:` optimistic update without `onError` rollback using `context` (MU006)
- No `onError:` and no typed error generic (MU007)
- `useMutation` without typed first generic (MU013)
- `setState(` or `dispatch(` inside `onSuccess` — use query cache (MU013)
- No test files (tests-pass hard-fails)
