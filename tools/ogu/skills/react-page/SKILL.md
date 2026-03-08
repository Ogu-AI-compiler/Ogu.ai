---
name: react-page
description: Compiler skill for the react-page compiler. Activates when producing page-artifact.json. Gates: RP001–RP012. Upstream: optionally schema-artifact.json.
---

# react-page — Compiler Skill

## What This Compiler Does

Compiles a React page component. Enforces naming convention (PascalCase ending in `Page` or `View`), SEO title declaration, loading states for data-fetching pages, error boundary/state handling, empty state for list pages, typed route params, no raw `fetch()` in page body, layout wrapper, and auth guard when required.

**Upstream dependency:** optionally `schema-artifact.json`
**Output artifact:** `page-artifact.json`
**IR identifier:** `PAGE:{name}`

---

## Spec Shape

```json
{
  "name": "UserProfilePage",
  "route": "/users/:id",
  "layout": "DashboardLayout",
  "auth": "required",
  "params": ["id"],
  "data": ["userProfile", "userPosts"]
}
```

`name` — PascalCase page name.
`route` — URL path including any params with `:param` syntax.
`layout` — layout component name or `"none"`.
`auth` — `"required"` | `"optional"` | `"none"`. Controls auth guard requirement.
`params` — optional array of URL params. Used for cross-checking with `useParams`.
`data` — optional array of data keys. When present, loading and error states are required.

---

## File Structure

| File | Purpose |
|---|---|
| `Page.tsx` or `UserProfilePage.tsx` | Page component |
| `Page.test.tsx` | Tests — required |

---

## Gates

### RP001 — spec-valid
Reads `page-spec.json`. Fails if missing or invalid JSON.

Required fields: `name`, `route`, `layout`, `auth`.

BAD: Missing `auth`. Missing `route`.
GOOD:
```json
{
  "name": "DashboardPage",
  "route": "/dashboard",
  "layout": "AppLayout",
  "auth": "required"
}
```

### RP002 — naming-valid
Page `.tsx` file must export a component whose name ends with `Page` or `View`.

BAD: `export function Dashboard() { ... }` — doesn't end in Page/View.
GOOD:
```tsx
export function DashboardPage() { ... }
export default DashboardView;
```

### RP005 — route-params
Three checks for URL parameter access:

1. `useParams()` without a type generic is blocked:
   ```tsx
   const { id } = useParams(); // BAD — untyped
   const { id } = useParams<{ id: string }>(); // GOOD
   ```

2. Every param in `spec.params` must appear in `Page.tsx`.

3. Destructuring `params` from props in Next.js App Router style must be typed:
   ```tsx
   // BAD
   function UserPage({ params }) { ... }
   // GOOD
   function UserPage({ params }: { params: { id: string } }) { ... }
   ```

### RP006 — data-loading
Required when `spec.data[]` is non-empty or `spec.async: true` (or page uses any `use*` hooks).
Skipped for static pages with no hooks.

`Page.tsx` must both declare a loading state variable AND use it in the JSX render path:

```tsx
if (isLoading) return <PageSkeleton />; // used in JSX return
```
or
```tsx
return (
  <div>
    {isLoading ? <Spinner /> : <UserCard />}
  </div>
);
```

Accepted patterns: `isLoading`, `loading`, `isPending`, `<Suspense`, `<Skeleton`, `<Spinner`, `<Loading`

BAD:
```tsx
// Has isLoading variable but never renders a loading UI
const { data, isLoading } = useUserProfile(id);
return <UserCard user={data} />; // renders even while loading
```

### RP007 — error-boundary
Required when page uses any hooks. Skipped for static pages.

Page must handle error state from its data hooks. Accepted patterns:
- `error && <ErrorMessage />` — conditional render
- `if (error) return <ErrorPage />;` — early return
- `<ErrorBoundary>` wrapper
- `isError`, `error?.message`, `error ?` ternary

BAD:
```tsx
const { data, error } = useUser(id);
return <UserCard user={data} />; // error state ignored
```
GOOD:
```tsx
const { data, error, isLoading } = useUser(id);
if (isLoading) return <PageSkeleton />;
if (error) return <ErrorMessage error={error} onRetry={refetch} />;
return <UserCard user={data} />;
```

### RP010 — seo-meta
Every page must declare its SEO title. Accepted patterns:
- `document.title = 'Title'`
- `<title>` tag in JSX
- Next.js App Router: `export const metadata = { title: '...' }` or `generateMetadata()`
- React Helmet: `<Helmet><title>...</title></Helmet>`
- Next.js Pages Router: `<Head><title>...</title></Head>`
- `useTitle(` / `useMeta(` hooks

BAD: Page component with no title declaration.
GOOD:
```tsx
// Next.js App Router
export const metadata = { title: 'User Profile | App' };

// Or React Helmet
<Helmet><title>User Profile | App</title></Helmet>

// Or programmatic
useEffect(() => { document.title = `${user.name} | App`; }, [user.name]);
```

### RP011 — empty-state
Required when `Page.tsx` uses `.map(` or `spec.data[]` is non-empty. Skipped for non-list pages.

Page must handle the empty list case. Accepted patterns:
- `items.length === 0` / `items.length == 0`
- `<EmptyState` / `<Empty` component
- `isEmpty` variable
- `"No results"` / `"Nothing here"` / `"No data"` text
- `data?.map(...)` — optional chaining (implies empty-safe)
- Ternary null return on empty data

BAD:
```tsx
const { items } = useUserList();
return <ul>{items.map(i => <li key={i.id}>{i.name}</li>)}</ul>;
// blank screen when items is empty
```
GOOD:
```tsx
if (!items || items.length === 0) return <EmptyState message="No users found" />;
return <ul>{items.map(i => <li key={i.id}>{i.name}</li>)}</ul>;
```

### RP012 — contract-page
Four structural rules:

| Rule | Requirement |
|---|---|
| `uses-layout` | `spec.layout` (when not `"none"`) must be referenced in `Page.tsx` |
| `no-raw-fetch` | No `fetch(` in page component body or useEffect — use compiled hooks |
| `auth-guard` | When `spec.auth !== 'none'`: `useAuth`, `useSession`, `isAuthenticated`, `redirect(`, or `router.replace` must be present |
| `error-recovery` | When error state is rendered, must include a `Retry` button or back link (`router.back`, `Link`, `href`) |

BAD (auth required but no guard):
```tsx
// spec.auth: "required" but no redirect or useAuth
export function AdminPage() {
  const { data } = useAdminData();
  return <AdminDashboard data={data} />;
}
```
GOOD:
```tsx
export function AdminPage() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) redirect('/login');
  const { data } = useAdminData();
  return (
    <AppLayout>
      <AdminDashboard data={data} />
    </AppLayout>
  );
}
```

### no-any / cross-schema / ts-valid / coverage / tests-pass / no-todos
- **no-any**: `: any`, `as any` blocked
- **cross-schema**: if schema-artifact.json exists, data props must align with schema
- **ts-valid**: `tsc --noEmit` must pass
- **coverage**: ≥80% statement coverage
- **tests-pass**: hard-fails if no test files; vitest or jest must pass
- **no-todos**: `TODO`, `FIXME`, `HACK`, `XXX` blocked

---

## What This Compiler Never Forgives

- `page-spec.json` missing (RP001 hard-fails)
- Exported component not ending in `Page` or `View` (RP002)
- `useParams()` without type generic (RP005)
- Data-fetching page with no loading state in JSX (RP006)
- Data-fetching page with no error state handling (RP007)
- No SEO title declaration (RP010)
- List page (has `.map(`) with no empty state handling (RP011)
- Layout in spec not used in page (RP012)
- Raw `fetch(` in page component body — use hooks (RP012)
- `spec.auth !== 'none'` but no auth guard (RP012)
- Error rendered without retry/back action (RP012)
- No test files (tests-pass hard-fails)
