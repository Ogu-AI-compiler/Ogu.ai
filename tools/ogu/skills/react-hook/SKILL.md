---
name: react-hook
description: Compiler skill for the react-hook compiler. Activates when producing hook-artifact.json. Gates: RH001–RH011. Upstream: optionally schema-artifact.json.
---

# react-hook — Compiler Skill

## What This Compiler Does

Compiles a custom React hook. Enforces naming conventions (`use*` prefix), Rules of Hooks (no conditional calls), cleanup of side effects (setTimeout/addEventListener/subscribe must return cleanup), stable dependency arrays, typed return values, and async safety (try/catch + loading/error states). Functions returned from the hook must be wrapped in `useCallback`.

**Upstream dependency:** optionally `schema-artifact.json`
**Output artifact:** `hook-artifact.json`
**IR identifier:** `HOOK:{name}`

---

## Spec Shape

```json
{
  "name": "useUserProfile",
  "purpose": "Fetch and manage user profile data with edit support",
  "returns": "{ profile, isLoading, error, updateProfile }",
  "async": true,
  "sideEffects": ["fetch"]
}
```

`name` — must start with `use` followed by an uppercase letter (`useX...`). `userfoo` fails.

`purpose` — description of what the hook does.

`returns` — description of what the hook returns (used for documentation, not enforced as code).

`async` — optional boolean. When `true`, gates require `isLoading`/`error` states in the return value and `try/catch` around all `await` calls.

`sideEffects` — optional array. Informational. Hooks with `fetch` or `subscription` side effects need cleanup.

---

## File Structure

| File | Purpose |
|---|---|
| `useUserProfile.ts` or `useUserProfile.tsx` | Hook implementation |
| `useUserProfile.test.ts` | Tests — required |

The hook file name must match the `use*` pattern exactly.

---

## Gates

### RH001 — spec-valid
Reads `hook-spec.json`. Fails if missing or invalid JSON.

Required fields: `name` (string), `purpose` (string), `returns` (string).

`name` must:
- Start with `"use"`
- Have an uppercase letter at index 3 (camelCase after `use`)

BAD: `"name": "userfoo"` — no uppercase after use. `"name": "fetchUser"` — no `use` prefix.
GOOD: `"name": "useUserProfile"`, `"name": "useAuth"`, `"name": "useDebounce"`

### RH002 — naming-valid
The hook file must be named `use[A-Z]*.ts` or `use[A-Z]*.tsx` (excluding `.test.*` files).

Every `export function` and `export const` in that file must start with `use`.

BAD: file named `UserHook.ts`. Exported function named `fetchUser` instead of `useUser`.
GOOD:
```
useUserProfile.ts
useAuth.ts
useDebounce.tsx
```

### RH005 — no-conditional-hooks
React Rules of Hooks: hook calls (`useX(...)`) must never appear inside:
- `if` / `else if` / `else` blocks
- `for` / `while` / `do-while` loops
- `switch` / `case` blocks
- Ternary expressions: `condition ? useX() : useY()`

The gate tracks brace depth and flags any hook call that appears inside a conditional block.

BAD:
```ts
export function useUserProfile(id: string) {
  if (id) {
    const data = useCache(id); // BLOCKED — conditional hook call
  }
  return {};
}
```
GOOD:
```ts
export function useUserProfile(id: string) {
  const data = useCache(id); // always at top level
  if (!id) return { profile: null };
  return data;
}
```

### RH006 — cleanup-effects
Every `useEffect` that creates a subscription, timer, or event listener must return a cleanup function.

**Patterns that require cleanup:**
- `setTimeout(` / `setInterval(`
- `.addEventListener(`
- `.subscribe(` / `.on(` / `.addListener(`
- `new WebSocket(` / `new EventSource(`
- `new IntersectionObserver(` / `new ResizeObserver(` / `new MutationObserver(`
- `new AbortController(`

The gate extracts each `useEffect` body and checks for a `return () => ...` or `return function ...` inside it.

BAD:
```ts
useEffect(() => {
  const handler = () => setCount(c => c + 1);
  window.addEventListener('resize', handler); // no cleanup — memory leak
}, []);
```
GOOD:
```ts
useEffect(() => {
  const handler = () => setCount(c => c + 1);
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler); // cleanup
}, []);
```
BAD:
```ts
useEffect(() => {
  const timer = setInterval(tick, 1000); // no cleanup — timer leaks
}, []);
```
GOOD:
```ts
useEffect(() => {
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
}, []);
```

### RH009 — stable-deps
Two checks for `useCallback`, `useMemo`, `useEffect`, `useLayoutEffect`:

**Missing dependency array** (useEffect/useLayoutEffect only): a `useEffect` with no second argument runs on every render — almost always a bug.

BAD:
```ts
useEffect(() => { fetchData(); }); // no deps — runs every render
```
GOOD:
```ts
useEffect(() => { fetchData(); }, [userId]); // only when userId changes
```

**Stale closure** (heuristic): if the dependency array is `[]` but the callback references more than 2 variables that aren't defined inside the callback, it's flagged as a potential stale closure.

BAD:
```ts
const userId = props.userId;
useEffect(() => {
  fetchProfile(userId, token, orgId); // 3 outer vars with empty deps
}, []); // potential stale closure — userId/token/orgId never update the effect
```
GOOD:
```ts
useEffect(() => {
  fetchProfile(userId, token, orgId);
}, [userId, token, orgId]); // deps declared
```

### RH011 — contract-hook
Four contract rules:

| Rule | Requirement |
|---|---|
| `typed-return` | Hook must return a typed object (`return { ... }`) or a documented tuple with `as const`. Returning `void` or bare values fails. |
| `async-states` | When `spec.async: true`: return object must include `isLoading`/`loading`/`isPending` AND `error`/`isError` |
| `stable-callbacks` | If the hook returns functions in its object, `useCallback` must appear in the file |
| `error-boundary-compatible` | When `spec.async: true`: all `await` calls must be inside `try/catch` |

BAD (missing async states):
```ts
// spec.async: true but hook doesn't expose loading/error
export function useUserProfile() {
  const [data, setData] = useState(null);
  useEffect(() => { fetch('/api/me').then(r => r.json()).then(setData); }, []);
  return data; // not an object, no isLoading, no error
}
```
GOOD:
```ts
export function useUserProfile() {
  const [profile, setProfile] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setIsLoading(true);
    fetch('/api/me')
      .then(r => r.json())
      .then(setProfile)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, []);

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    try {
      await fetch('/api/me', { method: 'PATCH', body: JSON.stringify(updates) });
    } catch (err) {
      setError(err as Error);
    }
  }, []);

  return { profile, isLoading, error, updateProfile };
}
```

### no-any / cross-schema / coverage / tests-pass / no-todos
- **no-any**: `: any`, `as any` blocked in hook files
- **cross-schema**: if `schema-artifact.json` exists, returned data props must align with schema fields
- **coverage**: ≥80% statement coverage
- **tests-pass**: hard-fails if no test files; vitest or jest must pass
- **no-todos**: `TODO`, `FIXME`, `HACK`, `XXX` blocked

---

## Complete Correct Hook Pattern

```ts
// useUserProfile.ts
import { useState, useEffect, useCallback } from 'react';

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

interface UseUserProfileReturn {
  profile: UserProfile | null;
  isLoading: boolean;
  error: Error | null;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

export function useUserProfile(userId: string): UseUserProfileReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);    // RH011: async-states
  const [error, setError] = useState<Error | null>(null); // RH011: async-states

  useEffect(() => {
    if (!userId) return;  // guard, not conditional hook
    const controller = new AbortController(); // RH006: cleanup setup
    setIsLoading(true);

    fetch(`/api/users/${userId}`, { signal: controller.signal })
      .then(r => r.json())
      .then(setProfile)
      .catch(err => { if (err.name !== 'AbortError') setError(err); })
      .finally(() => setIsLoading(false));

    return () => controller.abort(); // RH006: cleanup
  }, [userId]); // RH009: deps declared

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    try { // RH011: error-boundary-compatible
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      setProfile(await res.json());
    } catch (err) {
      setError(err as Error);
    }
  }, [userId]); // RH011: stable-callbacks via useCallback

  return { profile, isLoading, error, updateProfile }; // RH011: typed-return object
}
```

---

## What This Compiler Never Forgives

- `hook-spec.json` missing (RH001 hard-fails)
- Hook name not starting with `use` (RH001)
- `use` followed by lowercase letter: `usefoo` → must be `useFoo` (RH001)
- No hook file named `use[A-Z]*.ts/tsx` (RH002 hard-fails)
- Exported function without `use` prefix (RH002)
- Hook call inside `if`, `for`, `while`, `switch`, or ternary (RH005)
- `useEffect` with `setTimeout`/`addEventListener`/`subscribe`/`new WebSocket` and no `return () => cleanup()` (RH006)
- `useEffect` with no dependency array (RH009)
- Async hook (`spec.async: true`) returning without `isLoading` or `error` (RH011)
- `await` calls without `try/catch` in async hook (RH011)
- Hook returns functions without `useCallback` (RH011)
- No test files (tests-pass hard-fails)
