---
name: route-resilience
description: Compiler skill for the route-resilience compiler. Activates when producing resilience-artifact.json. Gates: RR001–RR010. No upstream dependency.
---

# route-resilience — Compiler Skill

## What This Compiler Does

Compiles the route resilience layer — error boundaries wrapping routes with fallback UI and reset capability, 404 catch-all handling, and Suspense boundaries for lazy-loaded routes. Enforces: `ErrorBoundary` with `FallbackComponent` used and exported, fallback includes `resetErrorBoundary`/retry mechanism, a catch-all `path="*"` route exists, and `<Suspense fallback={...}>` wraps any `React.lazy()` usage.

**Upstream dependency:** none (cross-checks `routing-artifact.json` if present)
**Output artifact:** `resilience-artifact.json`
**IR identifier:** `ROUTE_RESILIENCE`

---

## Spec Shape

```json
{
  "errorBoundary": true,
  "notFoundPath": "*",
  "suspenseFallback": "PageLoader"
}
```

Required fields:
- `errorBoundary` — `true`/`false` (must be explicitly set)
- `notFoundPath` — the 404 catch-all path, e.g. `"*"` or `"/404"`

---

## Implementation Shape

```tsx
import { ErrorBoundary } from 'react-error-boundary';
import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';

const HomePage = lazy(() => import('./pages/HomePage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert">
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

export function NotFound() {
  return <div><h1>404 — Page not found</h1></div>;
}

export function AppRoutes() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
```

---

## Gates

### RR001 — spec-valid
Reads `resilience-spec.json`. Required: `errorBoundary` (must be `true` or `false` — not absent), `notFoundPath` (string).

BAD: Missing `errorBoundary` or `notFoundPath`.
GOOD: `{ "errorBoundary": true, "notFoundPath": "*" }`

### RR002 — no-any
No `: any` type annotations.

### RR003 — ts-valid
TypeScript files must compile.

### RR004 — error-boundary
Implementation must:
1. Import `ErrorBoundary` from `react-error-boundary` OR use class component with `getDerivedStateFromError`/`componentDidCatch`
2. Use `<ErrorBoundary>` as a JSX element (not just imported)
3. Declare `FallbackComponent`, `fallback=`, or `renderError`/`ErrorFallback`

BAD:
```tsx
import { ErrorBoundary } from 'react-error-boundary';
// Never used in JSX
```
BAD:
```tsx
<ErrorBoundary>  // no FallbackComponent
  <App />
</ErrorBoundary>
```
GOOD:
```tsx
<ErrorBoundary FallbackComponent={ErrorFallback}>
  <App />
</ErrorBoundary>
```

### RR005 — not-found-route
A 404/catch-all route must be present: `path="*"`, `path="/*"`, or a `NotFound`/`Page404`/`Error404` component.

BAD: No catch-all — unknown URLs show blank page or crash.
GOOD:
```tsx
<Route path="*" element={<NotFound />} />
```

### RR006 — suspense-fallback
Skipped if `React.lazy()` is not used.

When `lazy()` is present, `<Suspense fallback={...}>` must wrap it with a non-empty `fallback` prop.

BAD:
```tsx
const Page = lazy(() => import('./Page'));
// no Suspense wrapper
```
BAD:
```tsx
<Suspense>  // fallback prop missing
  <Page />
</Suspense>
```
GOOD:
```tsx
<Suspense fallback={<PageLoader />}>
  <Page />
</Suspense>
```

### RR007 — tests-pass
All tests pass.

### RR008 — no-todos
`TODO`, `FIXME`, `HACK`, `XXX` blocked.

### RR009 — cross-routing
Skipped if `routing-artifact.json` not found. When found in the project, it's checked to exist (does not verify pass/fail).

### RR010 — contract-resilience
Four contract rules:

| Rule | Requirement |
|---|---|
| `error-boundary` | `<ErrorBoundary FallbackComponent={...}>` or `fallback=` present |
| `not-found-route` | `path="*"` or `NotFound`/`Page404` component present |
| `exported-components` | `ErrorFallback`/`NotFound`/`Error404`/`Page404` must be exported |
| `error-reset` | `resetErrorBoundary`/`onReset`/`retry`/`reset` present in fallback component |

BAD: `ErrorFallback` not exported (can't be imported by tests). No reset button in fallback.
GOOD: Both `ErrorFallback` and `NotFound` exported, fallback has `resetErrorBoundary` call.

---

## What This Compiler Never Forgives

- `resilience-spec.json` missing (RR001 hard-fails)
- `errorBoundary` field missing (RR001)
- `notFoundPath` missing (RR001)
- `ErrorBoundary` imported but not used in JSX (RR004)
- `ErrorBoundary` used without `FallbackComponent` (RR004)
- No 404/catch-all route (RR005)
- `React.lazy()` used without `<Suspense>` wrapper (RR006)
- `<Suspense>` without `fallback` prop (RR006)
- `ErrorFallback` or `NotFound` not exported (RR010)
- No reset mechanism in error fallback (RR010)
