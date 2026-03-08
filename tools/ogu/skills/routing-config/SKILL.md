---
name: routing-config
description: Compiler skill for the routing-config compiler. Activates when producing routing-artifact.json. Gates: RC001–RC012. No upstream dependency.
---

# routing-config — Compiler Skill

## What This Compiler Does

Compiles the application routing configuration. Enforces typed path params, lazy-loading for top-level routes (React Router), no dead or cyclic routes, a 404 catch-all, `<Suspense>` fallback, and error boundaries. Next.js App/Pages Router is exempt from lazy-loading (handled automatically).

**Upstream dependency:** none
**Output artifact:** `routing-artifact.json`
**IR identifier:** `ROUTING`

---

## Spec Shape

```json
{
  "type": "react-router-v6",
  "routes": [
    { "path": "/", "component": "HomePage" },
    { "path": "/users", "component": "UsersPage" },
    {
      "path": "/users/:id",
      "component": "UserDetailPage",
      "children": [
        { "path": "edit", "component": "UserEditPage" }
      ]
    },
    { "path": "/login", "component": "LoginPage", "auth": "none" },
    { "path": "*", "component": "NotFoundPage" }
  ]
}
```

`type` — `react-router-v6` | `next-app-router` | `next-pages-router` | `tanstack-router`

Each route must have `path` and one of `component`, `redirect`, or `children`.

---

## Gates

### RC001 — spec-valid
Reads `routing-spec.json`. Fails if missing or invalid JSON.

`routes` must be a non-empty array. Each route needs `path` and at least one of `component`, `redirect`, or `children`. Router `type` must be in the valid set if specified.

### RC004 — no-dead-routes
Static route paths declared in the spec must appear in the route config source file.

If a route is in the spec but its path string doesn't appear in the route configuration file, it's flagged as a potential dead route.

Skipped when no route config file is found.

### RC005 — no-cyclic-routes
Redirect chains must not form cycles. DFS traversal of `route.redirect` values in spec.

BAD:
```json
{ "path": "/old", "redirect": "/new" }
{ "path": "/new", "redirect": "/old" }
// infinite redirect loop
```
GOOD: All redirect chains terminate.

### RC006 — lazy-loading
Skipped for `next-app-router` and `next-pages-router` (handled automatically).

For React Router: top-level route components must be loaded via `React.lazy(` or `dynamic(` to enable code splitting.

BAD:
```ts
import { HomePage } from './pages/HomePage'; // eager import
const routes = [{ path: '/', element: <HomePage /> }];
```
GOOD:
```ts
const HomePage = lazy(() => import('./pages/HomePage'));
const routes = [{ path: '/', element: <Suspense fallback={<Spinner />}><HomePage /></Suspense> }];
```

### RC007 — typed-params
Every `:paramName` in route paths must have a TypeScript type definition.

For each parameterized route, the param name must appear with a type:
```ts
type RouteParams = { id: string; slug: string };
```
or in the component's `useParams` generic:
```ts
const { id } = useParams<{ id: string }>();
```

### RC012 — contract-routing
Five contract rules:

| Rule | Requirement |
|---|---|
| `lazy-top-level` | `lazy(` or `dynamic(` used for code splitting |
| `suspense-boundary` | `<Suspense>` or `fallback=` wrapper for lazy routes |
| `no-string-navigation` | Not more than 4 hardcoded `navigate('...')` string literals |
| `error-element` | `errorElement` or `ErrorBoundary` present for route-level error handling |
| `not-found-route` | A `path="*"`, `NotFound`, `404`, or `not-found` catch-all route exists |

---

## cross-guard / cross-page / no-any / ts-valid / tests-pass / no-todos
Standard gates.

---

## What This Compiler Never Forgives

- `routing-spec.json` missing (RC001 hard-fails)
- Route missing `component`, `redirect`, or `children` (RC001)
- Unknown `type` value (RC001)
- Cyclic redirect chain (RC005)
- Top-level components not wrapped in `React.lazy` for non-Next.js (RC006)
- `:paramName` in route without TypeScript type (RC007)
- No `<Suspense>` around lazy routes (RC012)
- No error boundary or `errorElement` in router (RC012)
- No catch-all 404 route (RC012)
- No test files (tests-pass hard-fails)
