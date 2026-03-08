---
name: query-module
description: Compiler skill for the query-module compiler. Activates when producing query-artifact.json. Gates: QM001–QM012. Upstream: optionally route-artifact.json.
---

# query-module — Compiler Skill

## What This Compiler Does

Compiles a TanStack Query (React Query) data-fetching hook. Read-only only — GET and HEAD methods. Enforces exported query keys with all params included, enabled guards for required params, no side effects in `queryFn`, typed generics, `staleTime` set, and no raw `fetch()` inside the query function.

**Upstream dependency:** optionally `route-artifact.json`
**Output artifact:** `query-artifact.json`
**IR identifier:** `QUERY:{hookName}`

---

## Spec Shape

```json
{
  "hookName": "useUserProfile",
  "endpoint": "/api/users/:id",
  "method": "GET",
  "responseType": "UserProfile",
  "pathParams": ["id"],
  "queryParams": [
    { "name": "include", "required": false }
  ],
  "routeArtifact": "../user-route/route-artifact.json"
}
```

`hookName` — must start with `use`.
`endpoint` — API path.
`method` — **must be `GET` or `HEAD`**. POST/PUT/PATCH/DELETE belong in `mutation-module`.
`responseType` — TypeScript type name of the response.
`pathParams` — array of path param names. All must appear in `queryKey`.
`queryParams` — array of query param objects or strings. Required params must appear in `queryKey`.
`routeArtifact` — optional relative path to compiled route artifact for cross-validation.

---

## Gates

### QM001 — spec-valid
Reads `query-spec.json`. Fails if missing or invalid JSON.

Required fields: `hookName`, `endpoint`, `method`, `responseType`.

`method` must be `GET` or `HEAD`. Writes belong in mutation-module.

BAD: `"method": "POST"` — use mutation-module. Missing `responseType`.
GOOD:
```json
{
  "hookName": "useUsers",
  "endpoint": "/api/users",
  "method": "GET",
  "responseType": "User[]"
}
```

### QM002 — naming-valid
`spec.hookName` must start with `use`. The hook file must be named `use*.ts` or `use*.tsx`.

The hook file must export a query key constant:
- `export const userQueryKey = [...]`
- `export const userKeys = { ... }`
- `export const USER_KEYS = [...]`

BAD: No exported queryKey constant — consumers can't invalidate or prefetch.
GOOD:
```ts
export const userQueryKeys = {
  all: ['users'] as const,
  detail: (id: string) => ['users', id] as const,
};
```

### QM003 — querykey-valid
Every `pathParam` and required `queryParam` from the spec must appear inside the `queryKey` array.

The gate looks for:
- `queryKey: [...]` inside a `useQuery` call
- `export const xKey = (param) => [...]` — exported key factory function

BAD: spec declares `pathParams: ["id"]` but queryKey is `['users']` with no `id`.
GOOD:
```ts
const { data } = useQuery({
  queryKey: ['users', id],  // id included
  queryFn: () => fetchUser(id),
  staleTime: 5 * 60 * 1000,
});
```

### QM006 — enabled-guard
Skipped if no required params in spec.

When the spec has `pathParams` or required `queryParams`, the `useQuery` call must have an `enabled` guard to prevent requests with undefined params.

Accepted patterns:
- `enabled: !!id`
- `enabled: Boolean(id)`
- `enabled: id !== undefined`
- `enabled: id != null`

BAD:
```ts
const { data } = useQuery({
  queryKey: ['users', userId],
  queryFn: () => fetchUser(userId), // fires with undefined userId on first render
});
```
GOOD:
```ts
const { data } = useQuery({
  queryKey: ['users', userId],
  queryFn: () => fetchUser(userId!),
  enabled: !!userId, // prevents request when userId is undefined
});
```

### QM007 — no-side-effects
The `queryFn` body must not perform side effects. Blocked inside queryFn:
- `fetch(` with `'POST'`, `'PUT'`, `'PATCH'`, or `'DELETE'` method
- `axios.post(`, `axios.put(`, `axios.patch(`, `axios.delete(`
- `localStorage.setItem(`, `sessionStorage.setItem(`
- Direct DOM mutations (`document.getElementById...= `)

BAD:
```ts
queryFn: async () => {
  const data = await fetchUser(id);
  localStorage.setItem('lastUser', id); // side effect in queryFn
  return data;
}
```
GOOD:
```ts
queryFn: () => fetchUser(id), // pure data fetch
// side effects go in onSuccess or useEffect
```

### QM011 — cross-route
Skipped if `spec.routeArtifact` is not set.

When set: the artifact must exist. Validates:
- Endpoint in spec matches route artifact `endpoint`
- HTTP method matches route artifact `method`
- If route artifact has `output_schema`, the hook's response type should align

### QM012 — contract-query
Five contract rules:

| Rule | Requirement |
|---|---|
| `typed-return` | `useQuery<ResponseType>` — typed generic required |
| `stale-time` | `staleTime:` must be explicitly set — default 0 is almost never correct |
| `error-typed` | `useQuery<Data, Error>` — error type must be specified |
| `no-direct-fetch` | `queryFn` must call a typed fetcher function, not raw `fetch()` inline |
| `select-memoized` | If `select:` is used, must be wrapped in `useCallback` (inline arrow = new reference every render) |

BAD:
```ts
const { data } = useQuery({ // no generics, no staleTime
  queryKey: ['user', id],
  queryFn: () => fetch(`/api/users/${id}`).then(r => r.json()), // raw fetch
});
```
GOOD:
```ts
const { data, isLoading, error } = useQuery<UserProfile, ApiError>({
  queryKey: userQueryKeys.detail(id),
  queryFn: () => userApi.getProfile(id), // typed fetcher
  staleTime: 5 * 60 * 1000, // 5 minutes
  enabled: !!id,
});
```

### no-any / ts-valid / coverage / tests-pass / no-todos
Standard gates — no `: any`, TypeScript passes, ≥80% coverage, tests pass, no TODOs.

---

## What This Compiler Never Forgives

- `query-spec.json` missing (QM001 hard-fails)
- `method` is POST/PUT/PATCH/DELETE — use mutation-module (QM001)
- No hook file named `use*.ts/tsx` (QM002 hard-fails)
- Query key not exported (QM002)
- pathParam/queryParam not included in queryKey array (QM003)
- Required param without `enabled: !!param` guard (QM006)
- POST/PUT/PATCH/DELETE or `localStorage.setItem` inside `queryFn` (QM007)
- `useQuery` without typed generic `<ResponseType>` (QM012)
- No `staleTime:` set (QM012)
- Raw `fetch()` inline inside `queryFn` instead of a typed fetcher (QM012)
- Inline `select:` arrow without `useCallback` (QM012)
- No test files (tests-pass hard-fails)
