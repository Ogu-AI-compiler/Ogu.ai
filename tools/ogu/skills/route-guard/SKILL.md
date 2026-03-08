---
name: route-guard
description: Compiler skill for the route-guard compiler. Activates when producing guard-artifact.json. Gates: RG001–RG011. No upstream dependency.
---

# route-guard — Compiler Skill

## What This Compiler Does

Compiles a React route guard component that protects routes from unauthenticated access. Enforces: redirect to a declared path when not authenticated, no flash of protected content (loading state before redirect), `replace: true` on redirect to avoid polluting history, and rendering `{children}` or `<Outlet />` when authenticated.

**Upstream dependency:** none
**Output artifact:** `guard-artifact.json`
**IR identifier:** `ROUTE_GUARD:{name}`

---

## Spec Shape

```json
{
  "name": "AuthGuard",
  "redirectTo": "/login",
  "authHook": "useAuth",
  "roles": ["admin", "member"]
}
```

`name` — guard component name.
`redirectTo` — must be an absolute path starting with `/`.
`authHook` — name of the auth hook used to check authentication state.
`roles` — optional array. When set, the guard also checks user roles.

---

## Gates

### RG001 — spec-valid
Reads `guard-spec.json`. Fails if missing or invalid JSON.

Required fields: `name`, `redirectTo`, `authHook`.

`redirectTo` must start with `/`.

BAD: `"redirectTo": "login"` — missing leading slash.
GOOD:
```json
{
  "name": "AuthGuard",
  "redirectTo": "/login",
  "authHook": "useAuth"
}
```

### RG004 — redirect-on-unauth
The guard component must:
1. Check auth state: `isAuthenticated`, `isLoggedIn`, `user === null`, `!user`, or `!isAuth`
2. Redirect unauthenticated users via: `navigate(`, `<Navigate`, `redirect(`, or `router.push`
3. Redirect to the path declared in `spec.redirectTo`

BAD:
```tsx
// Guard that just renders children — no protection
export function AuthGuard({ children }) {
  return <>{children}</>;
}
```
GOOD:
```tsx
export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
```

### RG005 — no-flash
Flash of protected content occurs when `{children}` or `<Outlet />` is rendered before the auth check resolves.

Two checks:
1. `{children}` or `<Outlet />` must appear **after** the auth check in source order
2. An `isLoading`/`isPending` guard must be present to hold rendering during auth resolution

BAD (flash pattern):
```tsx
export function AuthGuard({ children }) {
  const { isAuthenticated } = useAuth();
  return ( // children rendered without loading check!
    <>
      {children}
      {!isAuthenticated && <Navigate to="/login" />}
    </>
  );
}
```
GOOD:
```tsx
export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />; // hold during resolution
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>; // children only after auth confirmed
}
```

### RG006 — loading-state
Auth state takes time to resolve (cookie check, token validation, session fetch). The guard must show loading UI during this time.

Requires both:
1. A loading check: `isLoading`, `isPending`, or `loading.*return`
2. A loading UI: `Spinner`, `Skeleton`, `Loading`, `CircularProgress`, or `loader`

BAD:
```tsx
if (isLoading) return null; // blank screen during auth check
```
GOOD:
```tsx
if (isLoading) return <LoadingSpinner />;
```

### RG011 — contract-guard
Four contract rules:

| Rule | Requirement |
|---|---|
| `loading-before-redirect` | `isLoading` or `isPending` used |
| `replace-on-redirect` | Redirect uses `replace` or `replace={true}` — prevents browser back going to protected route |
| `children-or-outlet` | Must render `{children}` or `<Outlet />` when authenticated |
| `no-hardcoded-user` | Must not compare against a hardcoded user object — use auth hook |

BAD (no replace):
```tsx
return <Navigate to="/login" />; // back button returns to protected route
```
GOOD:
```tsx
return <Navigate to="/login" replace />; // history entry replaced
```

### cross-auth / cross-routing / no-any / ts-valid / tests-pass / no-todos
- **cross-auth**: if auth-artifact exists, authHook must match declared auth hook
- **cross-routing**: if routing-artifact exists, redirectTo must be a registered route
- **no-any**: `: any`, `as any` blocked
- **ts-valid**: `tsc --noEmit` must pass
- **tests-pass**: hard-fails if no test files; vitest or jest must pass
- **no-todos**: `TODO`, `FIXME`, `HACK`, `XXX` blocked

---

## What This Compiler Never Forgives

- `guard-spec.json` missing (RG001 hard-fails)
- `redirectTo` not starting with `/` (RG001)
- No auth check (`isAuthenticated`/`!user`) in guard (RG004)
- No redirect (`<Navigate>` or `navigate(`) (RG004)
- Redirect goes to a different path than `spec.redirectTo` (RG004)
- `{children}` rendered before auth check resolves (RG005)
- No `isLoading` check during auth resolution (RG005, RG006)
- Loading state renders nothing (blank screen) instead of UI (RG006)
- Redirect without `replace` — back button goes to protected route (RG011)
- No `{children}` or `<Outlet />` rendered when authenticated (RG011)
- No test files (tests-pass hard-fails)
