# Route Guard Compiler — Agent Prompt

You are implementing a React auth guard component (ProtectedRoute/RequireAuth) that passes all gates of the Route Guard Compiler.

## Spec file: `guard-spec.json`
```json
{
  "component": "ProtectedRoute",
  "redirectTo": "/login",
  "authHook": "useAuth",
  "roles": ["admin", "user"]
}
```

## Gates you must satisfy

| ID | Gate | Rule |
|----|------|------|
| RG001 | spec-valid | guard-spec.json must exist with `component` and `redirectTo` fields |
| RG002 | ts-valid | No TypeScript compilation errors |
| RG003 | no-any | No explicit `any` types |
| RG004 | redirect-on-unauth | Must call `navigate()` or `<Navigate>` when not authenticated |
| RG005 | no-flash | `{children}` must not render before auth check resolves |
| RG006 | loading-state | Must render a loading indicator while auth is pending |
| RG007 | no-todos | No TODO/FIXME comments |
| RG008 | tests-pass | All tests pass |
| RG009 | cross-auth | auth-artifact.json must exist (compile auth-middleware first) |
| RG010 | cross-routing | `redirectTo` path must be registered in routing-artifact.json |
| RG011 | contract-guard | Typed children prop, isAuthenticated check, redirect pattern |

## Implementation rules

1. **No flash** — auth check BEFORE rendering children:
   ```tsx
   if (isLoading) return <Spinner />;
   if (!isAuthenticated) return <Navigate to="/login" replace />;
   return <>{children}</>;  // children LAST
   ```

2. **Typed children**:
   ```tsx
   interface Props { children: React.ReactNode }
   ```

3. **No raw `any`** — use proper auth state types.

## Files to produce
- `ProtectedRoute.tsx` — guard component
- `ProtectedRoute.test.tsx` — tests: redirect when unauth, renders children when auth, shows spinner
