---
name: error-boundary-wrapper
description: Compiler skill for the error-boundary-wrapper compiler. Activates when producing error-boundary-artifact.json. Gates: EB001–EB009. No upstream dependency.
---

# error-boundary-wrapper — Compiler Skill

## What This Compiler Does

Compiles a React error boundary component. React error boundaries must be class components (or use `react-error-boundary` library). Enforces: proper React lifecycle methods (`getDerivedStateFromError` or `componentDidCatch`), a safe fallback UI, structured error reporting (not just `console.log`), and the component is exported and accepts children.

**Upstream dependency:** none
**Output artifact:** `error-boundary-artifact.json`
**IR identifier:** `ERROR_BOUNDARY:{component}`

---

## Spec Shape

```json
{
  "component": "AppErrorBoundary",
  "fallback_component": "ErrorFallback",
  "scope": "app",
  "reportTo": "sentry"
}
```

`component` — class component or wrapper name.
`fallback_component` — fallback UI component name.
`scope` — `app` | `page` | `widget` — the boundary scope.
`reportTo` — optional. Error reporting destination.

---

## Gates

### EB001 — spec-valid
Reads `error-boundary-spec.json`. Required fields: `component`, `fallback_component`, `scope`.

### EB004 — class-api
Error boundaries in React cannot be function components. Two valid approaches:

1. **Class component** with `getDerivedStateFromError` or `componentDidCatch`:
```tsx
class AppErrorBoundary extends React.Component<Props, State> {
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    captureException(error, { extra: info });
  }
  render() {
    if (this.state.hasError) return <ErrorFallback error={this.state.error} />;
    return this.props.children;
  }
}
```

2. **`react-error-boundary` library** (preferred for most use cases):
```tsx
import { ErrorBoundary } from 'react-error-boundary';
export function AppErrorBoundary({ children }) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onError={captureException}>
      {children}
    </ErrorBoundary>
  );
}
```

BAD: A plain function component — React will not catch render errors in it:
```tsx
export function AppErrorBoundary({ children }) {
  try { return children; } catch (err) { return <ErrorFallback />; }
}
```

### EB005 — safe-fallback
A fallback UI must be defined. The fallback component must have a safe render path — it must not itself throw errors.

Required patterns: `FallbackComponent`, `fallback=`, `renderError`, `ErrorFallback`, or `fallbackRender`.

BAD: Error boundary with no fallback renders blank on error.
GOOD:
```tsx
function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert">
      <h2>Something went wrong</h2>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}
```

### EB006 — structured-report
If `componentDidCatch` or `onError` is present, the error reporting must use a structured sink — not just `console.log`.

Accepted sinks: `Sentry`, `captureException`, `reportError`, `logger.`, `errorService`.

BAD:
```ts
componentDidCatch(error: Error) {
  console.log(error); // unstructured — not searchable in production
}
```
GOOD:
```ts
componentDidCatch(error: Error, info: ErrorInfo) {
  Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
}
```
Note: if neither `componentDidCatch` nor `onError` is present, this gate passes (reporting is optional for simple boundaries).

### EB009 — contract-error-boundary
Three contract rules:

| Rule | Requirement |
|---|---|
| `has-fallback` | `FallbackComponent`, `fallback=`, `ErrorFallback`, or `fallbackRender` present |
| `no-async-render` | `render()` method must not be `async` |
| `exports-boundary` | Component must be exported (default or named) |

---

## What This Compiler Never Forgives

- `error-boundary-spec.json` missing (EB001 hard-fails)
- Using a function component instead of class or `react-error-boundary` (EB004)
- Class component without `getDerivedStateFromError` or `componentDidCatch` (EB004)
- No fallback UI defined (EB005)
- Fallback component that itself throws (EB005)
- `componentDidCatch` using only `console.log` without a real reporting sink (EB006)
- No default or named export (EB009)
- `async render()` — React render methods cannot be async (EB009)
- No test files (tests-pass hard-fails)
