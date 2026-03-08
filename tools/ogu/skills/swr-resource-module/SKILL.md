---
name: swr-resource-module
description: Compiler skill for the swr-resource-module compiler. Activates when producing swr-resource-artifact.json. Gates: SW001–SW010. No upstream dependency.
---

# swr-resource-module — Compiler Skill

## What This Compiler Does

Compiles a SWR data-fetching custom hook — an alternative to React Query's `useQuery` for simpler caching needs. Enforces: `useSWR` is imported and called, SWR key is parameterized (not a plain static string), `{ data, error }` properly destructured, revalidation strategy declared, no direct cache internal access, and the hook is exported with typed generics.

**Upstream dependency:** none
**Output artifact:** `swr-resource-artifact.json`
**IR identifier:** `SWR_RESOURCE:{resource}`

---

## Spec Shape

```json
{
  "resource": "useUserProfile",
  "key_pattern": "/api/users/[id]",
  "revalidation": {
    "revalidateOnFocus": true,
    "revalidateOnReconnect": true,
    "dedupingInterval": 5000
  }
}
```

Required fields:
- `resource` — the custom hook name (should start with `use`)
- `key_pattern` — URL pattern for the SWR key
- `revalidation` — object describing the revalidation strategy

---

## Implementation Shape

```tsx
import useSWR from 'swr';

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useUserProfile(userId: string) {
  const { data, error, isLoading, mutate } = useSWR<UserProfile>(
    userId ? [`/api/users/${userId}`, userId] : null,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
    }
  );

  return {
    profile: data,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
```

---

## Gates

### SW001 — spec-valid
Reads `swr-resource-spec.json`. Required: `resource`, `key_pattern`, `revalidation`.

BAD: Missing any required field.
GOOD: `{ "resource": "useUserProfile", "key_pattern": "/api/users/[id]", "revalidation": {...} }`

### SW002 — no-any
No `: any` type annotations.

### SW003 — ts-valid
TypeScript files must compile.

### SW004 — unique-key
`useSWR()` must be present and the SWR key must be parameterized — not a plain static string literal.

BAD:
```ts
useSWR('/api/users', fetcher)
// static string — not parameterized, can't support multiple users
```
GOOD:
```ts
useSWR(['/api/users', userId], fetcher)
useSWR(`/api/users/${userId}`, fetcher)
useSWR(userId ? `/api/users/${userId}` : null, fetcher)
```

### SW005 — revalidation-declared
At least one revalidation strategy must be declared in `useSWR` options:
- `revalidateOnFocus`
- `revalidateOnReconnect`
- `refreshInterval`
- `revalidateIfStale`
- `dedupingInterval`

BAD: `useSWR(key, fetcher)` — no options, uses SWR defaults silently.
GOOD: `useSWR(key, fetcher, { revalidateOnFocus: true, dedupingInterval: 5000 })`

### SW006 — no-cache-internals
Direct SWR cache manipulation is blocked:
- `.cache[...` direct cache access
- `cache.set(...)` / `cache.delete(...)`
- `useSWRConfig().cache` access
- `mutate(undefined, undefined)` — clearing all cache

Use `mutate(key)` for targeted revalidation instead.

BAD:
```ts
const { cache } = useSWRConfig();
cache.delete('/api/users'); // direct cache manipulation
```
GOOD:
```ts
mutate(['/api/users', userId]); // targeted revalidation via SWR API
```

### SW007 — state-shape
`useSWR` result must destructure at minimum `{ data, error }`. Both are required — `data` for the response, `error` for error handling.

BAD:
```ts
const result = useSWR(key, fetcher);
return result.data; // no error handling
```
BAD:
```ts
const { data } = useSWR(key, fetcher);
// error not destructured — failures silently ignored
```
GOOD:
```ts
const { data, error, isLoading } = useSWR<UserProfile>(key, fetcher, options);
```

### SW008 — tests-pass
All tests pass.

### SW009 — no-todos
`TODO`, `FIXME`, `HACK`, `XXX` blocked.

### SW010 — contract-swr
Three contract rules:

| Rule | Requirement |
|---|---|
| `uses-swr` | `from 'swr'` import AND `useSWR(` call |
| `typed-data` | `useSWR<TypeName>` generic type parameter |
| `exported-hook` | Custom hook is exported (`export function use...` or `export const use...`) |

BAD: SWR not typed with generics. Hook function not exported.
GOOD:
```ts
import useSWR from 'swr';
// ...
const { data, error } = useSWR<UserProfile>([key, id], fetcher);
export function useUserProfile(id: string) { ... }
```

---

## What This Compiler Never Forgives

- `swr-resource-spec.json` missing (SW001 hard-fails)
- `resource`, `key_pattern`, or `revalidation` missing (SW001)
- `: any` type annotations (SW002)
- No `useSWR()` call found (SW004)
- Plain static string SWR key (SW004)
- No revalidation strategy in useSWR options (SW005)
- Direct `.cache` access or `cache.set`/`cache.delete` (SW006)
- `useSWR` result not destructuring `data` (SW007)
- `useSWR` result not destructuring `error` (SW007)
- `useSWR` without generic type parameter (SW010)
- Custom hook not exported (SW010)
