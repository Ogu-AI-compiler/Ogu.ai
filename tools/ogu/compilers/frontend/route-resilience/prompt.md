# Route Resilience Compiler — Agent Prompt

You are implementing error boundaries and fallback UI for app routes that pass all gates of the Route Resilience Compiler.

## Spec file: `resilience-spec.json`
```json
{
  "errorBoundary": true,
  "notFoundPath": "*",
  "suspense": true,
  "errorFallback": "ErrorFallback"
}
```

## Gates you must satisfy

| ID | Gate | Rule |
|----|------|------|
| RR001 | spec-valid | resilience-spec.json with `errorBoundary` and `notFoundPath` |
| RR002 | ts-valid | No TypeScript compilation errors |
| RR003 | no-any | No explicit `any` |
| RR004 | error-boundary | `<ErrorBoundary FallbackComponent={ErrorFallback}>` wraps routes |
| RR005 | not-found-route | `path="*"` catch-all route with NotFound component |
| RR006 | suspense-fallback | If lazy() is used, wrap with `<Suspense fallback={...}>` |
| RR007 | no-todos | No TODO/FIXME |
| RR008 | tests-pass | All tests pass |
| RR009 | cross-routing | routing-artifact.json must exist |
| RR010 | contract-resilience | ErrorBoundary+fallback+reset, NotFound exported |

## Required pattern

```tsx
import { ErrorBoundary } from 'react-error-boundary';
import { Suspense, lazy } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));

export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert">
      <p>Something went wrong</p>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

export function NotFound() {
  return <div><h1>404 — Page not found</h1></div>;
}

export function AppRoutes() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => {}}>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
```

## Files to produce
- `AppRoutes.tsx` — routes with ErrorBoundary, Suspense, and NotFound
- `ErrorFallback.tsx` — error fallback UI with reset
- `NotFound.tsx` — 404 page
- `AppRoutes.test.tsx` — tests: error caught, 404 rendered, suspense
