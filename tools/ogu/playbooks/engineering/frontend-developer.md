---
role: "Frontend Developer"
category: "engineering"
min_tier: 1
capacity_units: 10
---

# Frontend Developer Playbook

## Core Methodology

### Component Architecture
- Components are the unit of composition. Every component should do one thing well.
- Separate data-fetching components (containers) from presentation components.
- Props flow down, events flow up. Never reach into child component internals.
- Co-locate styles, tests, and types with the component they belong to.
- Extract shared components only when used in 3+ places. Premature abstraction is costly.

### State Management
- Local state first. Lift state only when two siblings need it.
- Global state is for truly global concerns: auth, theme, locale.
- Server state (fetched data) is not application state. Use a data-fetching library.
- Derived state should be computed, not stored. Storing computed values leads to sync bugs.
- Form state is local. Submitting the form sends data to the server.

### Rendering Strategy
- Minimize re-renders. Use memoization only when profiling shows it helps.
- Virtualize long lists (>100 items). Rendering 1000 DOM nodes is never acceptable.
- Lazy-load routes and heavy components. Initial bundle should load core shell only.
- Images: use responsive srcset, lazy loading, and modern formats (WebP/AVIF).
- Avoid layout shifts: reserve space for async content with skeleton placeholders.

### CSS Architecture
- Use a design token system for colors, spacing, typography, and shadows.
- Component styles are scoped. Global styles are limited to resets and tokens.
- Never use inline styles for anything that should respond to themes.
- Use logical properties (margin-inline, padding-block) for RTL support.
- Class naming: BEM or utility-first. Pick one and enforce it.

### Accessibility
- Every interactive element must be keyboard-accessible.
- All images have alt text. Decorative images use alt="".
- Form fields have associated labels. Placeholder is not a label.
- Color contrast: 4.5:1 minimum for normal text, 3:1 for large text.
- Screen reader testing: not optional. Test with VoiceOver or NVDA at least once per feature.
- Focus management: after navigation, focus moves to the new content.
- ARIA: use semantic HTML first. ARIA is a last resort, not a first choice.

### Error Handling
- Every async operation needs loading, success, and error states.
- Error boundaries catch rendering errors. They don't replace try/catch.
- User-facing errors must be actionable: "Upload failed. Check file size (max 5MB) and try again."
- Network errors: distinguish between offline, timeout, and server error.
- Never show stack traces to users. Log them; show a friendly message.

## Checklists

### Component Development Checklist
- [ ] Component renders without props (sensible defaults)
- [ ] All interactive elements are keyboard-accessible
- [ ] Loading state displays skeleton or spinner
- [ ] Error state shows actionable message
- [ ] Empty state provides guidance ("No items yet. Create your first.")
- [ ] Component works at mobile, tablet, and desktop widths
- [ ] Dark mode / theme variant works correctly
- [ ] No hardcoded strings (all user-facing text is localizable)

### Performance Checklist
- [ ] Bundle size impact measured (no single component > 50KB gzipped)
- [ ] Images optimized and lazy-loaded
- [ ] Lists with >50 items are virtualized
- [ ] No unnecessary re-renders (verified with React DevTools Profiler)
- [ ] Fonts preloaded; no FOIT/FOUT
- [ ] Third-party scripts loaded async/defer

### Pre-PR Checklist
- [ ] Storybook stories cover all states (default, loading, error, empty, overflow)
- [ ] Unit tests cover business logic and edge cases
- [ ] Integration test covers the primary user flow
- [ ] No console.log or debugger statements
- [ ] TypeScript strict mode: no `any` types
- [ ] Responsive: tested at 320px, 768px, 1280px widths

## Anti-Patterns

### Prop Drilling
Passing props through 4+ levels of components that don't use them.
Fix: Use context or composition. If a component doesn't use a prop, it shouldn't receive it.

### Fetch-on-Render Cascades
Parent renders → child mounts → child fetches → grandchild renders → grandchild fetches.
Fix: Fetch all required data at the route level or use parallel data-fetching patterns.

### The Mega Component
A single file with 500+ lines handling state, data fetching, rendering, and event handling.
Fix: Extract hooks for logic, separate container from presentation, split sub-components.

### Overusing Global State
Putting form data, UI state, and server cache into a global store.
Fix: Only truly global data (user session, theme) belongs in global state.

### CSS !important Abuse
Using !important to override styles indicates a specificity architecture problem.
Fix: Reduce specificity. Use design tokens. Scope styles to components.

### Ignoring Browser Compatibility
Building with latest features without checking target browser support.
Fix: Define browser matrix in project config. Use polyfills or progressive enhancement.

## When to Escalate

- Design spec requires a layout that causes performance issues (>100 DOM repaints/s).
- A third-party dependency has a known security vulnerability with no patch available.
- API response shape does not match the agreed contract, blocking frontend work.
- Accessibility audit reveals WCAG AA violations that require design changes.
- Performance budget is exceeded and optimization alone cannot fix it (architecture change needed).
- Browser compatibility issue affects >5% of users with no reasonable polyfill.

## Testing Strategy

### Unit Tests
- Test business logic in hooks and utilities, not DOM structure.
- Mock API calls, not internal functions.
- Test edge cases: empty arrays, null values, very long strings, special characters.

### Integration Tests
- Test user flows: "User fills form → submits → sees confirmation."
- Use testing-library: query by role and text, not by CSS class or test-id.
- Avoid testing implementation details (state shape, method calls).

### Visual Regression
- Capture screenshots for critical components in all states.
- Compare against baselines on every PR.
- Review visual diffs before merging.

### E2E Tests
- Cover the 3-5 most critical user journeys.
- Run in CI on every PR. Flaky tests are bugs.
- Use stable selectors: data-testid for E2E, role queries for integration.

## Performance Targets

- First Contentful Paint: < 1.5s on 3G
- Largest Contentful Paint: < 2.5s
- Cumulative Layout Shift: < 0.1
- First Input Delay: < 100ms
- Time to Interactive: < 3.5s
- Total bundle size: < 200KB gzipped (initial load)

## Build and Deploy

- Tree-shaking: verify dead code is eliminated. Check bundle analyzer.
- Code splitting: one chunk per route. Shared chunks for common dependencies.
- Source maps: upload to error tracking service, never serve to users.
- Cache strategy: immutable filenames (content hash) with long cache headers.
- CDN: serve static assets from edge. HTML from origin.

## Code Quality Standards

### TypeScript Discipline
- Strict mode: always. No `any` types in production code.
- Prefer `unknown` over `any` when type is truly unknown at compile time.
- Use discriminated unions for state: `{ status: "loading" } | { status: "success", data: T } | { status: "error", error: Error }`.
- Generic types for reusable components: `function useAsync<T>(fn: () => Promise<T>)`.
- Barrel exports: use sparingly. They hurt tree-shaking and increase bundle size.

### Code Organization
- Feature-based folders: `/features/auth/`, `/features/dashboard/`, not `/components/`, `/hooks/`.
- Shared components: `/shared/ui/` for design system components only.
- Hooks: co-locate with the feature that uses them. Extract to shared only when reused.
- Constants: centralize in feature-level constants file. No magic strings.
- Types: co-locate with the module. Shared types in `/shared/types/`.

### Naming Conventions
- Components: PascalCase, descriptive (`UserProfileCard`, not `Card`).
- Hooks: `use` prefix + verb + noun (`useLoadUser`, not `useUser`).
- Event handlers: `handle` prefix + event (`handleSubmitForm`, `handleClickDelete`).
- Boolean props: `is`/`has`/`should` prefix (`isLoading`, `hasError`).

## Debugging Strategy

### Browser DevTools
- Network tab: check request timing waterfall for slow endpoints.
- Performance tab: record user interactions to find render bottlenecks.
- Memory tab: heap snapshots before and after to detect leaks.
- Application tab: inspect storage, cookies, service workers.

### Common Frontend Bugs
- Stale closures: hooks capturing old values. Fix with refs or dependency arrays.
- Race conditions: component unmounts during async operation. Fix with abort controllers.
- Memory leaks: subscriptions not cleaned up on unmount. Fix with cleanup functions.
- Hydration mismatches (SSR): server render differs from client. Fix with `useEffect` for client-only content.

## Internationalization

- All user-facing strings through an i18n library (react-intl, next-intl).
- Date/time formatting: use Intl.DateTimeFormat, never manual string formatting.
- Number formatting: use Intl.NumberFormat for currencies, percentages.
- RTL support: use CSS logical properties. Test with RTL locale.
- Pluralization rules: different languages have different plural forms. Use ICU syntax.

<!-- skills: code-implementation, component-design, css-systems, accessibility, performance-web, state-management, responsive-design, testing-frontend, build-optimization, debugging -->
