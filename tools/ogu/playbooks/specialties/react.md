# React Specialty Addendum

## Component Patterns
- Use functional components exclusively. Class components are legacy.
- Custom hooks for reusable logic. Prefix with `use`.
- `useEffect` cleanup: always return a cleanup function for subscriptions and timers.
- `useMemo` and `useCallback`: only when React DevTools Profiler shows unnecessary re-renders.
- Avoid prop spreading (`{...props}`) — it hides dependencies and breaks type safety.

## State Management
- `useState` for simple local state. `useReducer` for complex state with multiple sub-values.
- React Query / TanStack Query for server state. Never put API data in Redux.
- Context for truly global state (theme, locale, auth). Not for frequently changing data.
- Zustand or Jotai for shared client state that changes often. Redux if the team already uses it.

## Performance
- React.lazy + Suspense for route-level code splitting.
- Virtualize lists with >100 items (react-window or react-virtuoso).
- Avoid anonymous functions in JSX for components that re-render frequently.
- Use React DevTools Profiler to identify wasted renders before optimizing.
- Keys must be stable and unique. Never use array index as key for dynamic lists.

## Testing
- React Testing Library: query by role, text, or label. Never by CSS class.
- Test user behavior, not implementation details.
- Mock API calls with MSW (Mock Service Worker), not by mocking fetch directly.
- Snapshot tests: use sparingly. They catch unintentional changes but are noisy.

## Common Pitfalls
- useEffect with missing dependencies: enable exhaustive-deps ESLint rule.
- State updates in loops: batch with functional updates `setState(prev => ...)`.
- Conditional hooks: hooks must always be called in the same order. No hooks inside if/for.
- Memory leaks: cancel async operations in useEffect cleanup.
- Hydration mismatches in SSR: ensure server and client render identical initial content.

## File Structure
```
src/components/FeatureName/
  FeatureName.tsx        — main component
  FeatureName.test.tsx   — tests
  FeatureName.stories.tsx — Storybook
  useFeatureName.ts      — custom hook
  FeatureName.module.css — scoped styles
  index.ts               — public export
```

<!-- skills: react, hooks, component-design, react-testing, state-management, performance-web -->
