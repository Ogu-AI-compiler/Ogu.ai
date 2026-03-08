---
name: providers-scaffold
description: Compiler skill for the providers-scaffold compiler. Activates when producing providers-artifact.json. Gates: PR001–PR009. No upstream dependency.
---

# providers-scaffold — Compiler Skill

## What This Compiler Does

Compiles the application providers wrapper — the tree of context providers that wraps the entire app. Enforces: no duplicate providers, correct nesting order (ErrorBoundary outermost → QueryClientProvider → Router), QueryClient created at module scope (not inside a component), and the providers component accepts and renders `{children}`.

**Upstream dependency:** none
**Output artifact:** `providers-artifact.json`
**IR identifier:** `PROVIDERS`

---

## Spec Shape

```json
{
  "providers": [
    "ErrorBoundary",
    "QueryClientProvider",
    "BrowserRouter",
    "ThemeProvider",
    "AuthProvider",
    "ToastProvider"
  ]
}
```

`providers` — ordered array of provider names from outermost to innermost.

---

## Gates

### PR001 — spec-valid
Reads `providers-spec.json`. `providers` must be a non-empty array.

### PR004 — provider-order
Nesting order enforced by three rules (only checked when both providers exist):

| Rule | Requirement |
|---|---|
| ErrorBoundary before QueryClientProvider | ErrorBoundary must wrap QueryClientProvider to catch query errors |
| QueryClientProvider before RouterProvider | Queries available in route components |
| QueryClientProvider before BrowserRouter | Same — queries available in routes |

Order is determined by first occurrence in the JSX source.

BAD:
```tsx
<QueryClientProvider client={queryClient}>
  <ErrorBoundary>  {/* ErrorBoundary inside — query errors go uncaught */}
    <App />
  </ErrorBoundary>
</QueryClientProvider>
```
GOOD:
```tsx
<ErrorBoundary FallbackComponent={ErrorFallback}>
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </QueryClientProvider>
</ErrorBoundary>
```

### PR005 — no-duplicate-providers
Each provider component (`*Provider`) must appear exactly once. Duplicates cause double context initialization and unpredictable behavior.

BAD: `<ThemeProvider>` appears twice in the tree.
GOOD: Each provider appears exactly once.

### PR006 — queryclient-config
Skipped if no `QueryClient` in providers.

When `QueryClient` is present:
1. Must be instantiated at **module scope** (not inside a component function — causes re-creation on every render)
2. Must have `defaultOptions` with at least `staleTime` or `retry` configured

BAD:
```tsx
function Providers({ children }) {
  const queryClient = new QueryClient(); // re-created every render!
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```
GOOD:
```tsx
const queryClient = new QueryClient({ // module scope
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

### PR009 — contract-providers
Four contract rules:

| Rule | Requirement |
|---|---|
| `queryclient-module-scope` | `new QueryClient()` not inside a component function |
| `error-boundary-present` | `ErrorBoundary` in the providers tree |
| `single-export` | Single named or default export containing `Provider` in its name |
| `accepts-children` | Component renders `{children}` |

---

## What This Compiler Never Forgives

- `providers-spec.json` missing (PR001 hard-fails)
- `providers` is empty (PR001)
- ErrorBoundary appears inside QueryClientProvider (PR004)
- QueryClientProvider appears inside Router (PR004)
- Any provider duplicated in the tree (PR005)
- `new QueryClient()` inside component function body (PR006, PR009)
- `QueryClient` without `defaultOptions` (PR006)
- No `ErrorBoundary` in providers tree (PR009)
- No `{children}` rendered (PR009)
- No test files (tests-pass hard-fails)
