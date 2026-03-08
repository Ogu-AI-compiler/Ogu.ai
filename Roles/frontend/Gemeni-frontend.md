# Frontend Developer Role Decomposition: Domain Compiler Network

**Context:** Architecture spec for a Domain Compiler Network targeting the modern React ecosystem (TypeScript, React, Tailwind, Zustand, React Query, React Router).
**Existing Compilers:** `react-component`, `react-form`, `react-hook`, `react-page`, `ts-schema`.

---

## 1. Summary of Atomic Task Types

| Task Name (Compiler)       | Frequency                | Input                                  | Output                                     |
| :------------------------- | :----------------------- | :------------------------------------- | :----------------------------------------- |
| **`config-design-tokens`** | Per-project / Rare       | Figma variables / JSON theme           | `tailwind.config.ts`, `theme.css`          |
| **`gen-api-client`**       | Per-feature              | OpenAPI spec / GraphQL schema          | `api.ts`, custom React Query hooks         |
| **`gen-global-state`**     | Per-feature              | State machine diagram / Intent spec    | `store.ts` (Zustand/Redux slice)           |
| **`gen-routing-map`**      | Per-feature              | Route hierarchy, auth requirements     | `routes.ts`, React Router configuration    |
| **`gen-i18n-dict`**        | Per-feature              | Key-value mapping / CSV                | `en.json`, type-safe accessor hooks        |
| **`gen-error-boundary`**   | Per-project / Occasional | Fallback UI spec, logging intent       | `ErrorBoundary.tsx`                        |
| **`gen-animation-spec`**   | Per-feature              | Motion intent (duration, curve, state) | Framer Motion variants / CSS classes       |
| **`gen-ab-test-flag`**     | Daily / Weekly           | Experiment keys, variant names         | Higher-Order Component / Provider wrappers |
| **`gen-utility-fn`**       | Daily                    | Logic intent, I/O signature            | pure TS file, `.test.ts`                   |

---

## 2. Detailed Task Breakdown

### 2.1. `config-design-tokens` (Design System & Theming)

- **Frequency:** Per-project (setup) / Rare (updates).
- **Input:** Raw design tokens (colors, typography, spacing) usually in JSON or derived directly from Figma REST API.
- **Output:** `tailwind.config.ts`, global CSS variable definitions.
- **Correctness criteria:** \* Valid TypeScript object matching Tailwind's configuration schema.
  - No naming collisions in token keys.
  - Contrast ratios for defined color pairs must mathematically pass WCAG AA/AAA standards (formal gate).
- **Dependencies:** None.
- **Downstream consumers:** `react-component`, `react-page`, `gen-animation-spec`.

### 2.2. `gen-api-client` (Data Fetching & Mutations)

- **Frequency:** Per-feature.
- **Input:** OpenAPI/Swagger spec, REST endpoint intent, or GraphQL schema.
- **Output:** Typed fetcher functions and React Query/SWR hooks (e.g., `useGetUser`, `useUpdateUser`).
- **Correctness criteria:**
  - Hook names must start with `use`.
  - Input/Output payloads must strict-match the `ts-schema` generated from the API spec.
  - Must implement caching keys (QueryKeys) consistently as arrays.
  - Must include error type definitions.
- **Dependencies:** `ts-schema`.
- **Downstream consumers:** `react-hook`, `react-page`, `react-form`.

### 2.3. `gen-global-state` (Client-side State Management)

- **Frequency:** Per-feature.
- **Input:** State intent, allowed transitions (state machine), required actions.
- **Output:** Zustand store file (`useStore.ts`) or Redux slice.
- **Correctness criteria:**
  - AST check: State mutations must be immutable (e.g., enforcing spread operators or Immer usage).
  - No asynchronous logic inside synchronous reducers.
  - Exported selectors must be pure functions.
- **Dependencies:** `ts-schema`.
- **Downstream consumers:** `react-component`, `react-page`, `react-hook`.

### 2.4. `gen-routing-map` (Navigation & Layout Hierarchy)

- **Frequency:** Per-feature / Per-project.
- **Input:** URL structure, required path parameters, authentication rules.
- **Output:** Router configuration array/object (e.g., React Router `createBrowserRouter` or Next.js App Router folder structure).
- **Correctness criteria:**
  - No dead cyclic routes.
  - All path parameters must have corresponding type definitions.
  - Protected routes must have a formally defined auth boundary wrapper.
  - Lazy loading (`React.lazy` or equivalent) must be applied to top-level route components.
- **Dependencies:** `react-page`, `gen-error-boundary`.
- **Downstream consumers:** Application Root / Entry point.

### 2.5. `gen-i18n-dict` (Internationalization)

- **Frequency:** Per-feature.
- **Input:** Default language strings, variable interpolation points.
- **Output:** JSON dictionary files, strict TypeScript interfaces for translation keys.
- **Correctness criteria:**
  - All language JSONs must have exactly identical key trees.
  - Interpolation variables (e.g., `{{count}}`) must be present in all language variants of a specific key.
  - Generated TS interface must strictly type the available keys to prevent runtime missing-string errors.
- **Dependencies:** None.
- **Downstream consumers:** `react-component`, `react-page`, `react-form`.

### 2.6. `gen-error-boundary` (Resilience & Fallbacks)

- **Frequency:** Per-project / Occasional.
- **Input:** Fallback UI intent, reporting service intent (e.g., Sentry).
- **Output:** React Class Component implementing `componentDidCatch` and `getDerivedStateFromError`.
- **Correctness criteria:**
  - Must be a class component (React limitation for Error Boundaries).
  - Must implement state updates to render fallback UI.
  - Must catch errors cleanly without bubbling up unless explicitly configured.
- **Dependencies:** `react-component` (for the fallback UI).
- **Downstream consumers:** `gen-routing-map`, `react-page`.

### 2.7. `gen-animation-spec` (Motion & Interactions)

- **Frequency:** Per-feature.
- **Input:** Motion intent (e.g., "fade-in-up", duration, easing curve).
- **Output:** Framer Motion `variants` objects or Tailwind arbitrary value classes.
- **Correctness criteria:**
  - Valid easing curve syntax (cubic-bezier or preset).
  - `reduced-motion` media queries must be accounted for in the generated output to pass accessibility gates.
- **Dependencies:** `config-design-tokens`.
- **Downstream consumers:** `react-component`.

### 2.8. `gen-ab-test-flag` (Experimentation)

- **Frequency:** Daily / Weekly.
- **Input:** Experiment ID, variant list (`control`, `treatment`).
- **Output:** Higher-order component or conditional rendering utility.
- **Correctness criteria:**
  - Must include a default fallback (usually `control`) if the experimentation provider fails or times out.
  - Strict typing on variant names (no generic strings).
- **Dependencies:** `react-component`.
- **Downstream consumers:** `react-page`.

### 2.9. `gen-utility-fn` (Pure Logic & Data Transformation)

- **Frequency:** Daily.
- **Input:** Logic intent, data structure in, data structure out.
- **Output:** Pure TypeScript function and its unit test.
- **Correctness criteria:**
  - Must have 0 side effects (no DOM access, no network calls).
  - 100% test coverage generated alongside it.
  - AST check: Cannot import React.
- **Dependencies:** `ts-schema`.
- **Downstream consumers:** `react-hook`, `gen-api-client`, `react-component`.

---

## 3. Recommended Build Order (Dependency Graph)

To build this network, compilers must be instantiated in an order that respects the topological sort of their dependencies. You cannot compile a `react-page` if the `ts-schema` or `gen-api-client` it relies on doesn't exist.

**Layer 0: Primitives & Schemas (The Foundation)**

1.  `ts-schema` _(Existing)_ — Everything types against this.
2.  `config-design-tokens` — Required before any UI components can be styled.
3.  `gen-i18n-dict` — Required for text rendering.
4.  `gen-utility-fn` — Pure functions required by hooks and states.

**Layer 1: Logic & Data (The Brain)** 5. `gen-api-client` — Requires `ts-schema`. 6. `gen-global-state` — Requires `ts-schema` and `gen-utility-fn`. 7. `gen-animation-spec` — Requires `config-design-tokens`.

**Layer 2: Atomic UI (The Building Blocks)** 8. `react-hook` _(Existing)_ — Requires Layer 1 outputs. 9. `react-component` _(Existing)_ — Requires tokens, i18n, and animations. 10. `gen-error-boundary` — Requires `react-component` for fallbacks.

**Layer 3: Complex UI & Assembly (The Modules)** 11. `react-form` _(Existing)_ — Requires components, hooks, and schemas. 12. `gen-ab-test-flag` — Wraps components and modules.

**Layer 4: Views & Architecture (The Skeleton)** 13. `react-page` _(Existing)_ — Consumes forms, components, hooks, and API clients. 14. `gen-routing-map` — The final step; wires up the compiled pages, error boundaries, and auth guards into the application shell.
