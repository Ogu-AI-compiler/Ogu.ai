---
name: state-management
description: Designs and implements application state architecture for frontend and backend systems. Use when adding global state, migrating state solutions, debugging state-related bugs, or defining state machine flows. Triggers: "state management", "manage application state", "add Redux", "Zustand", "state architecture", "state machine".
---

# State Management

## When to Use
- Adding shared state that multiple components or services need
- Migrating from a messy state solution to a cleaner architecture
- Debugging state inconsistencies, stale data, or update ordering issues

## Workflow
1. Start local: can this state live in the component? Lift only when necessary
2. Categorize state: UI state (local) vs server state (cached) vs application state (global)
3. Use a data-fetching library for server state — it solves caching, revalidation, deduplication
4. Keep global state minimal: auth, locale, and theme; not UI details or form data
5. Make state transitions explicit: state machines for complex flows, simple reducers for lists

## Quality Bar
- No state derived from other state — compute derived values, don't store them
- State updates are predictable and testable in isolation
- Server state is never duplicated into global store — use a query cache instead
- State machines have a diagram documenting all states and transitions
