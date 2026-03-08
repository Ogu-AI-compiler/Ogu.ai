# Providers Scaffold Compiler — Agent Prompt

You are implementing an app-level React providers wrapper that passes all gates of the Providers Scaffold Compiler.

## Spec file: `providers-spec.json`
```json
{
  "providers": ["ErrorBoundary", "QueryClientProvider", "RouterProvider", "ThemeProvider"],
  "queryClientConfig": { "retry": 2, "staleTime": 60000 }
}
```

## Gates you must satisfy

| ID | Gate | Rule |
|----|------|------|
| PR001 | spec-valid | providers-spec.json must exist with non-empty `providers` array |
| PR002 | ts-valid | No TypeScript compilation errors |
| PR003 | no-any | No explicit `any` types |
| PR004 | provider-order | ErrorBoundary outermost, QueryClientProvider before RouterProvider |
| PR005 | no-duplicate-providers | Each provider appears exactly once |
| PR006 | queryclient-config | QueryClient created at module scope, not inside component |
| PR007 | no-todos | No TODO/FIXME comments |
| PR008 | tests-pass | All tests pass |
| PR009 | contract-providers | ErrorBoundary wrapper, single export, accepts children |

## Implementation rules

1. **QueryClient at module scope** — never inside a component function:
   ```tsx
   // ✓ correct
   const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 2, staleTime: 60000 } } });
   export function AppProviders({ children }: { children: React.ReactNode }) { ... }
   ```

2. **Provider order** (outermost → innermost):
   `ErrorBoundary > QueryClientProvider > RouterProvider > ThemeProvider > {children}`

3. **Single named export** matching `*Provider` or `*Providers` pattern.

4. **Must render `{children}`** inside the tree.

## Files to produce
- `Providers.tsx` — the provider tree
- `Providers.test.tsx` — renders children, checks QueryClient, checks ErrorBoundary
