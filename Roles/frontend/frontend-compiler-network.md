# Frontend Developer Role Decomposition

> **DOMAIN COMPILER NETWORK**

*A Formal Specification for Building One Compiler Per Task Type*

React · TypeScript · Vite/Next.js · Tailwind · Zustand/Redux · React
Query/SWR · React Router

## Purpose & Scope

This document provides an exhaustive decomposition of the frontend
developer role for the purpose of instantiating a Domain Compiler
Network --- one formally-specified compiler per discrete task type. Each
compiler accepts an intent (a spec artifact) and produces a verified,
attested output. The analysis covers the React/TypeScript ecosystem on a
modern stack (Vite or Next.js, Tailwind CSS, Zustand or Redux, React
Query or SWR, React Router or Next.js router).

Excluded from scope: DevOps, CI/CD pipeline authoring, backend API
implementation, and infrastructure provisioning. Included as edge-cases:
error boundaries, i18n, design tokens, animations, accessibility audits,
and A/B test variants.

**Already-built compilers:** react-component, react-form, react-hook,
react-page, ts-schema. These are noted throughout as ✓ EXISTS in the
build order section.

## Summary Table --- All 25 Task Types

The table below provides a high-level overview. Detailed per-task
breakdowns follow in the next section.

  -------- ---------------------- ------------------------ ------------------ -----------------------
  **\#**   **Task Name**          **Frequency**            **Input**          **Output**

  **01**   Design Token           Per-project / per-sprint Figma tokens JSON  tokens.css, tokens.ts,
           Compilation                                     / CSS vars spec    tailwind.config.ts

  **02**   React Component        Daily                    Figma frame +      .tsx component file +
           Authoring                                       component spec     .stories.tsx +
                                                                              .test.tsx

  **03**   React Form             Per-feature              Field spec +       Form .tsx, Zod schema,
           Construction                                    validation rules   field config

  **04**   React Hook Authoring   Per-feature / weekly     Behavior spec, API .ts hook file +
                                                           shape              .test.ts

  **05**   TypeScript Schema      Per-feature / per-model  API contract /     .ts schema file
           Definition                                      domain model spec  (Zod/type)

  **06**   React Page Assembly    Per-feature              Route spec, layout Page .tsx, route
                                                           wireframe, data    config, loader/action
                                                           reqs               

  **07**   State Machine / Store  Per-feature              State diagram,     Zustand store or Redux
           Authoring                                       event catalog      slice .ts

  **08**   Data-Fetching Hook     Per-feature              API endpoint +     useQuery/useMutation
           (Query Layer)                                   query key spec     hook .ts

  **09**   Routing Configuration  Per-feature /            Route tree spec    Route config file,
                                  per-project                                 router bootstrap

  **10**   Error Boundary         Per-feature / per-page   Error states spec, ErrorBoundary .tsx +
           Construction                                    fallback UI spec   error page

  **11**   Accessibility Audit &  Per-component /          Rendered           Patched .tsx + audit
           Remediation            per-release              component + WCAG   report .md
                                                           target level       

  **12**   Internationalisation   Per-project /            Locale list,       i18n config, locale
           (i18n) Setup           per-locale-add           string catalog,    JSON files, typed t()
                                                           date/number rules  hook

  **13**   Animation / Motion     Per-component /          Motion spec        .tsx with Framer Motion
           Authoring              per-feature              (easing, duration, variants
                                                           trigger)           

  **14**   Storybook Story        Per-component            Component + design .stories.tsx with all
           Authoring                                       states matrix      variants + controls

  **15**   Unit & Integration     Per-component / per-hook Component/hook +   .test.tsx / .test.ts
           Test Authoring                                  acceptance         (Vitest/RTL)
                                                           criteria           

  **16**   End-to-End Test        Per-user-flow /          User flow spec +   Playwright .spec.ts
           Authoring              per-release              critical paths     files

  **17**   A/B Test Variant       Per-experiment           Hypothesis,        Variant component(s) +
           Authoring                                       variant spec, flag feature-flag wrapper
                                                           key                

  **18**   Performance            Per-feature /            Bundle report,     Patched components,
           Optimisation           per-release              Core Web Vitals    split points,
                                                           baseline           memoisation

  **19**   CSS / Styling          Daily (inline) /         Design spec,       Tailwind classes, CSS
           Authoring              Per-component            design tokens      modules, or styled
                                                                              components

  **20**   Code-Splitting & Lazy  Per-route /              Bundle analysis,   React.lazy wrappers,
           Loading                per-heavy-component      route map          dynamic import points

  **21**   Environment & Config   Per-project / per-env    Env var list,      .env.\*, zod env
           Management                                      secret             schema, typed config
                                                           classification     module

  **22**   Design System          Per-project onboarding / Component library  Configured provider
           Integration            per-DS-update            docs, version spec wrappers, theme
                                                                              overrides

  **23**   Mock / Fixture         Per-feature              Data model + edge  MSW handlers, factory
           Authoring                                       case matrix        functions, fixture
                                                                              files

  **24**   Compound Component /   Per-reusable-component   Complex            Context + compound
           Headless UI Pattern                             interaction spec   component tree .tsx

  **25**   Icon & Asset Pipeline  Per-project /            SVG files, asset   React icon components,
                                  per-icon-batch           spec               optimised asset imports
  -------- ---------------------- ------------------------ ------------------ -----------------------

## Detailed Task Breakdowns

Each entry below defines the six formal properties a compiler must
implement: input contract, output artifact, correctness gates,
prerequisite dependencies, and downstream consumers.

### 01 Design Token Compilation** **Per-project / per-sprint

  ------------------ ---------------------------------------------------------
  **Field**          **Detail**

  **Input**          Figma token export (JSON), design system spec (colour
                     scales, spacing scale, typography scale, radius, shadow,
                     motion), target stack config (Tailwind v3/v4).

  **Output**         tokens.css (CSS custom properties), tokens.ts (typed
                     constant map), tailwind.config.ts (extended theme),
                     optional: style-dictionary config.

  **Correctness**    All CSS var names follow \--token-\[category\]-\[scale\]
                     convention; TypeScript token map is auto-generated (no
                     manual edits); tailwind.config theme.extend matches token
                     file exactly; no hardcoded hex/px values remain in
                     component files after compilation; tokens pass
                     contrast-ratio checks for aa/aaa targets.

  **Dependencies**   Figma token plugin output or equivalent JSON spec. No
                     code dependencies.

  **Downstream**     react-component (all visual atoms), css-styling compiler,
                     animation compiler, design-system-integration compiler.
  ------------------ ---------------------------------------------------------

### 02 React Component Authoring** **Daily

  ------------------ ---------------------------------------------------------
  **Field**          **Detail**

  **Input**          Figma frame (or equivalent design spec), component API
                     spec (props interface, variants, states:
                     default/hover/focus/disabled/error/loading),
                     accessibility notes (ARIA role, keyboard contract).

  **Output**         ComponentName.tsx (pure functional component),
                     ComponentName.stories.tsx, ComponentName.test.tsx,
                     index.ts barrel export.

  **Correctness**    Props interface is fully typed (no \'any\'); all
                     variant/state combinations are renderable via props
                     alone; component is a pure function (no side-effects in
                     render); passes axe-core with zero critical violations;
                     all interactive elements have aria-label or
                     aria-labelledby; supports ref forwarding where the
                     element is focusable; renders without console errors in
                     strict mode.

  **Dependencies**   ts-schema (for prop types), design-token compiler output.

  **Downstream**     react-form, react-page, compound-component,
                     storybook-story, unit-integration-test compilers.
  ------------------ ---------------------------------------------------------

### 03 React Form Construction** **Per-feature

  ------------------ ---------------------------------------------------------
  **Field**          **Detail**

  **Input**          Field specification (field names, types, labels,
                     placeholder, required/optional), validation rule set
                     (min/max, regex, async validators), submission target
                     (API endpoint or action), error message copy.

  **Output**         FormName.tsx (react-hook-form + Zod), formName.schema.ts
                     (Zod schema), formName.types.ts (inferred TS types),
                     optional: fieldConfig.ts (dynamic field config array).

  **Correctness**    Zod schema covers every field with appropriate
                     refinements; TypeScript infers correctly from schema (no
                     type assertions); all error messages map 1:1 to Zod error
                     paths; form is keyboard-navigable (tab order correct);
                     error messages are associated via aria-describedby;
                     submit is disabled during async validation; handles
                     network errors without crashing; passes with zero
                     axe-core violations.

  **Dependencies**   react-component (field atoms: Input, Select, Checkbox),
                     ts-schema (Zod), react-hook (useForm wrapper if
                     abstracted).

  **Downstream**     react-page (embedding form), unit-integration-test,
                     e2e-test compilers.
  ------------------ ---------------------------------------------------------

### 04 React Hook Authoring** **Per-feature / weekly

  ------------------ ---------------------------------------------------------
  **Field**          **Detail**

  **Input**          Behaviour spec (what state it manages, what side-effects
                     it triggers, its public API --- return shape),
                     optionally: API contract if data-fetching, dependency
                     list.

  **Output**         useHookName.ts (hook implementation), useHookName.test.ts
                     (Vitest + renderHook tests).

  **Correctness**    Hook follows Rules of Hooks (no conditional hook calls);
                     return type is fully typed; side-effects are encapsulated
                     in useEffect/useCallback with correct dependency arrays;
                     no stale closure bugs (verified via exhaustive-deps lint
                     rule); cleanup functions present for
                     subscriptions/timers; hook is independently testable
                     without DOM (pure logic) or via renderHook
                     (DOM-dependent).

  **Dependencies**   ts-schema (for return/param types), optionally react-hook
                     (if composing other hooks).

  **Downstream**     react-form, query-layer, state-machine, react-page
                     compilers.
  ------------------ ---------------------------------------------------------

### 05 TypeScript Schema Definition** **Per-feature / per-model

  ------------------ ---------------------------------------------------------
  **Field**          **Detail**

  **Input**          API contract (OpenAPI, Protobuf, or prose spec), domain
                     model description, validation requirements.

  **Output**         modelName.schema.ts (Zod schema + inferred TS types),
                     optionally modelName.mock.ts (factory function for test
                     data).

  **Correctness**    Schema covers all required and optional fields; inferred
                     TS types exported and used downstream (no
                     re-declaration); validators run at runtime for API
                     boundary data; Zod .parse() used at ingress points (not
                     .safeParse() silently dropped); discriminated unions used
                     for polymorphic models; no use of z.any() or z.unknown()
                     without explicit justification.

  **Dependencies**   None. This is the foundational primitive.

  **Downstream**     All other compilers except design-token and icon-asset.
  ------------------ ---------------------------------------------------------

### 06 React Page Assembly** **Per-feature

  ------------------ ---------------------------------------------------------
  **Field**          **Detail**

  **Input**          Route spec (path, params, loader data shape), layout
                     wireframe, list of child components/forms, data
                     requirements (queries, mutations), auth/guard
                     requirements, SEO metadata spec.

  **Output**         PageName.tsx (page component), optionally loader.ts /
                     action.ts (for React Router 6 data router or Next.js
                     server actions), routeConfig entry.

  **Correctness**    Page renders without errors for all param combinations;
                     loader/action handles all HTTP error codes (400, 401,
                     403, 404, 500) with typed error responses; Suspense
                     boundaries present for async data; page title and meta
                     tags set per spec; auth guard applied per route spec; no
                     unhandled promise rejections on mount; passes Lighthouse
                     score targets (perf, a11y, seo) defined in spec.

  **Dependencies**   react-component, react-form, query-layer, state-machine,
                     routing-config, ts-schema compilers.

  **Downstream**     e2e-test, a-b-variant, performance-optimisation
                     compilers.
  ------------------ ---------------------------------------------------------

### 07 State Machine / Store Authoring** **Per-feature

  ------------------ ---------------------------------------------------------
  **Field**          **Detail**

  **Input**          State diagram (states, transitions, guards, actions),
                     event catalog, slice boundary definition, persistence
                     requirements (sessionStorage / localStorage / none).

  **Output**         useStoreName.ts (Zustand store) or storeNameSlice.ts
                     (Redux slice) + storeNameSelectors.ts.

  **Correctness**    All state transitions are exhaustively typed; no direct
                     state mutation outside store actions (immer or Zustand\'s
                     set pattern); selectors are memoised (reselect or
                     Zustand\'s useShallow); store is reset-able for testing;
                     persisted slices use versioned migration schema; no
                     business logic in components --- components only call
                     actions and read selectors.

  **Dependencies**   ts-schema (for state shape types), react-hook (if
                     wrapping store access).

  **Downstream**     react-page, react-form, query-layer (for cache
                     invalidation), unit-integration-test compilers.
  ------------------ ---------------------------------------------------------

### 08 Data-Fetching Hook (Query Layer)** **Per-feature

  ------------------ ---------------------------------------------------------
  **Field**          **Detail**

  **Input**          API endpoint spec (URL pattern, HTTP method,
                     request/response schema, error codes), cache key
                     strategy, stale/refetch policy, optimistic update
                     requirements.

  **Output**         useQueryName.ts (React Query useQuery / useMutation
                     wrapper), queryKeys.ts entry.

  **Correctness**    Query key is unique and follows \[entity, params\] tuple
                     convention; request/response typed via ts-schema (no
                     \'any\'); all error states handled and typed;
                     loading/error/success states surfaced in return;
                     mutations include onSuccess cache invalidation;
                     optimistic updates include rollback on error; hook is
                     testable via msw + renderHook without real network calls.

  **Dependencies**   ts-schema (request/response types), react-hook (base hook
                     patterns), env-config (base URL).

  **Downstream**     react-page, react-form (async validation),
                     unit-integration-test, mock-fixture compilers.
  ------------------ ---------------------------------------------------------

### 09 Routing Configuration** **Per-feature / per-project

  ------------------ ---------------------------------------------------------
  **Field**          **Detail**

  **Input**          Route tree spec (paths, nested layouts, index routes,
                     error routes, auth guards, code-split boundaries), param
                     types.

  **Output**         routes.tsx (React Router v6 route config or Next.js
                     app/pages directory structure), typed param helpers.

  **Correctness**    All paths match spec exactly; typed params extracted via
                     useParams with correct types; 404 and error routes
                     present at every nested level; auth guards applied to
                     protected sub-trees; no wildcard routes that could shadow
                     valid paths; lazy() applied at route boundaries per
                     code-splitting spec.

  **Dependencies**   ts-schema (param types), react-page (page components must
                     exist or be stubbed).

  **Downstream**     react-page (for navigation), e2e-test, code-splitting
                     compilers.
  ------------------ ---------------------------------------------------------

### 10 Error Boundary Construction** **Per-feature / per-page

  ------------------ ---------------------------------------------------------
  **Field**          **Detail**

  **Input**          Error states spec (what errors to catch, fallback UI
                     design, reset behaviour), logging target (Sentry,
                     console, custom).

  **Output**         ErrorBoundary.tsx (class component boundary),
                     ErrorFallback.tsx (fallback UI), optionally
                     errorPage.tsx.

  **Correctness**    Catches all synchronous render errors in subtree; does
                     NOT catch async errors (correct --- these are handled by
                     Suspense/query error states); logs error + errorInfo to
                     specified logging target; exposes reset mechanism (either
                     retry button or navigate-away); boundary is granular
                     (wraps feature subtrees, not entire app); TypeScript
                     class component with correct getDerivedStateFromError and
                     componentDidCatch signatures.

  **Dependencies**   react-component (for fallback UI atoms), ts-schema (error
                     shape types).

  **Downstream**     react-page, unit-integration-test compilers.
  ------------------ ---------------------------------------------------------

### 11 Accessibility Audit & Remediation** **Per-component / per-release

  ------------------ ---------------------------------------------------------
  **Field**          **Detail**

  **Input**          Rendered component (or Storybook story), target WCAG
                     level (AA or AAA), keyboard interaction spec, colour
                     contrast tokens.

  **Output**         Patched .tsx files (remediated components), a11y-audit.md
                     (findings report with before/after), optionally updated
                     Storybook a11y addon config.

  **Correctness**    Zero axe-core critical or serious violations
                     post-remediation; all interactive elements reachable via
                     keyboard in logical order; focus indicators visible (min
                     3:1 contrast ratio); colour contrast meets WCAG 2.1 AA
                     (4.5:1 text, 3:1 UI components); no information conveyed
                     by colour alone; form errors announced to screen readers
                     via aria-live or aria-describedby; modal/dialog traps
                     focus correctly.

  **Dependencies**   react-component or react-form output, design-token output
                     (for contrast verification).

  **Downstream**     storybook-story, e2e-test (accessibility assertions),
                     react-page compilers.
  ------------------ ---------------------------------------------------------

**12 Internationalisation (i18n) Setup** **Per-project /
per-locale-add**

  ------------------ ---------------------------------------------------------
  **Field**          **Detail**

  **Input**          Locale list, string catalog (key: default English copy),
                     date/number/currency format rules, pluralisation rules,
                     RTL locale list.

  **Output**         i18n.config.ts (i18next or next-intl setup), en.json +
                     \[locale\].json translation files, useTranslation typed
                     wrapper hook, optionally i18n.d.ts (typed keys via
                     codegen).

  **Correctness**    No hardcoded user-facing strings remain in components
                     after compilation; all translation keys exist in every
                     locale file (missing key = compiler error); TypeScript
                     types for translation keys prevent key typos at compile
                     time; pluralisation rules correctly applied via count
                     param; dates/numbers formatted via
                     Intl.DateTimeFormat/NumberFormat (not manual
                     concatenation); RTL layouts flip correctly (CSS logical
                     properties used, not left/right).

  **Dependencies**   react-component (to audit for hardcoded strings),
                     ts-schema (for locale type), react-hook (typed t() hook).

  **Downstream**     react-component, react-form, react-page (all
                     string-containing components must re-run i18n pass),
                     e2e-test compilers.
  ------------------ ---------------------------------------------------------

### 13 Animation / Motion Authoring** **Per-component / per-feature

  ------------------ ---------------------------------------------------------
  **Field**          **Detail**

  **Input**          Motion spec (what triggers the animation, easing curve,
                     duration, stagger if list, reduced-motion fallback),
                     design token animation values.

  **Output**         Animated component .tsx (Framer Motion variants inline or
                     extracted), motionVariants.ts (if shared), optionally
                     useAnimation hook.

  **Correctness**    prefers-reduced-motion media query respected (animations
                     disabled or replaced with instant transitions); animation
                     does not cause layout shift (CLS impact assessed); Framer
                     Motion variants typed as Variants; no animation triggered
                     on initial mount unless specified; spring configs match
                     spec (stiffness, damping, mass); exit animations complete
                     before component unmounts (AnimatePresence used
                     correctly); no jank --- tested at 4x CPU throttle.

  **Dependencies**   react-component (component being animated), design-token
                     (easing/duration tokens).

  **Downstream**     storybook-story (stories must show animation states),
                     performance-optimisation (animation perf impact).
  ------------------ ---------------------------------------------------------

### 14 Storybook Story Authoring** **Per-component

  ------------------ ---------------------------------------------------------
  **Field**          **Detail**

  **Input**          Component with all props typed, design state matrix (all
                     variant × state combinations), interaction scripts (if
                     using \@storybook/addon-interactions).

  **Output**         ComponentName.stories.tsx (CSF3 format with Meta and
                     StoryObj types), controls config, action handlers.

  **Correctness**    Every exported variant from component API has a
                     corresponding story; args use actual TS types (no \'as
                     any\'); argTypes configured for all enum/union props;
                     stories render without console errors; a11y addon shows
                     zero violations for all stories; interactions stories
                     pass (if present); story names match design system naming
                     conventions.

  **Dependencies**   react-component, react-form, animation compilers
                     (components must be built first).

  **Downstream**     a11y-audit (Storybook is the audit surface),
                     unit-integration-test (stories can be reused as test
                     fixtures via \@storybook/test).
  ------------------ ---------------------------------------------------------

### 15 Unit & Integration Test Authoring** **Per-component / per-hook

  ------------------ ---------------------------------------------------------
  **Field**          **Detail**

  **Input**          Component or hook implementation, acceptance criteria
                     (behaviour spec), edge case matrix.

  **Output**         ComponentName.test.tsx (React Testing Library) or
                     useHookName.test.ts (Vitest + renderHook), optionally
                     test utilities/helpers.

  **Correctness**    Tests cover: happy path, all error states, loading
                     states, empty states, keyboard interactions, and each
                     acceptance criterion; no snapshots of dynamic content
                     (avoid brittle snapshot tests); no implementation detail
                     assertions (no testing of state variables directly); all
                     async tests use waitFor/findBy; test coverage gates:
                     branches ≥ 80%, lines ≥ 90%; tests pass in CI with zero
                     flaky failures across 10 runs.

  **Dependencies**   react-component, react-hook, react-form compilers;
                     mock-fixture compiler for test data.

  **Downstream**     CI quality gate; e2e-test (complements unit coverage).
  ------------------ ---------------------------------------------------------

### 16 End-to-End Test Authoring** **Per-user-flow / per-release

  ------------------ ---------------------------------------------------------
  **Field**          **Detail**

  **Input**          User flow spec (start state → actions → expected end
                     state), critical path list, environment config (base URL,
                     test user credentials).

  **Output**         flowName.spec.ts (Playwright), page object models (.ts),
                     test fixtures (.ts).

  **Correctness**    Tests cover all steps in user flow spec; assertions use
                     data-testid or accessible role selectors (never CSS class
                     selectors); network requests are intercepted/mocked for
                     non-critical paths and real for critical paths; tests are
                     idempotent (can run in any order, any number of times);
                     flakiness rate \< 1% over 100 runs; accessibility
                     assertions (axe) run on each page; visual regression
                     snapshots (if spec requires).

  **Dependencies**   react-page, routing-config compilers; deployed test
                     environment.

  **Downstream**     Release quality gate; performance-optimisation (E2E
                     timing data feeds perf baselines).
  ------------------ ---------------------------------------------------------

### 17 A/B Test Variant Authoring** **Per-experiment

  ------------------ ---------------------------------------------------------
  **Field**          **Detail**

  **Input**          Hypothesis spec, variant designs (A = control, B =
                     treatment, optionally C+), feature flag key, metrics
                     definition (what to measure), exposure logging
                     requirement.

  **Output**         VariantA.tsx / VariantB.tsx (or inline variant logic),
                     featureFlagWrapper.tsx, experiment.config.ts (flag key,
                     variant map).

  **Correctness**    Feature flag evaluation happens at the correct boundary
                     (component mount, not render loop); exposure event fired
                     exactly once per session per user (not per render);
                     variant components are fully isolated (no shared mutable
                     state between variants); TypeScript narrows variant type
                     from flag response; rollback to control works by flipping
                     flag with zero code changes; variants are independently
                     testable in Storybook and unit tests.

  **Dependencies**   react-component or react-page (whichever is being
                     varied), feature-flag SDK integration, ts-schema
                     (experiment config types).

  **Downstream**     e2e-test (must test both variants),
                     performance-optimisation (variants may have different
                     perf profiles).
  ------------------ ---------------------------------------------------------

### 18 Performance Optimisation** **Per-feature / per-release

  ------------------ ---------------------------------------------------------
  **Field**          **Detail**

  **Input**          Bundle analysis report (rollup-plugin-visualizer or
                     \@next/bundle-analyzer), Core Web Vitals baseline (LCP,
                     CLS, INP), React DevTools profiler trace.

  **Output**         Patched component files (memoisation applied, expensive
                     computations moved to useMemo/useCallback), updated
                     code-split boundaries, perf-report.md (before/after
                     metrics).

  **Correctness**    LCP improves by ≥ 10% or meets target threshold; CLS = 0
                     (no layout shift introduced); INP ≤ 200ms for all
                     interactions; no React component re-renders more than 2×
                     on single user interaction (verified via profiler);
                     bundle size delta per route ≤ spec\'d budget; no
                     re-introduction of previously eliminated re-renders
                     (regression gate).

  **Dependencies**   react-page, query-layer, code-splitting compilers;
                     profiling infrastructure.

  **Downstream**     Release quality gate; e2e-test (performance assertions
                     via Playwright).
  ------------------ ---------------------------------------------------------

### 19 CSS / Styling Authoring** **Daily (inline) / Per-component

  ------------------ ---------------------------------------------------------
  **Field**          **Detail**

  **Input**          Design spec (layout, spacing, colour, typography), design
                     tokens, responsive breakpoint spec.

  **Output**         Tailwind class strings within .tsx files, optionally CSS
                     module files (.module.css), theme extension in
                     tailwind.config.ts.

  **Correctness**    No arbitrary Tailwind values that duplicate existing
                     tokens (e.g., text-\[#1E3A5F\] when a token class
                     exists); responsive variants applied at correct
                     breakpoints; no !important overrides; dark mode classes
                     applied where spec\'d; hover/focus/active states styled;
                     no duplicate class names resolving to same property
                     (specificity conflicts); styles removed when component
                     removed (no orphaned CSS modules).

  **Dependencies**   design-token compiler (tailwind.config.ts must exist),
                     react-component (classes applied within components).

  **Downstream**     react-component, react-form, react-page (styling is
                     embedded in these outputs).
  ------------------ ---------------------------------------------------------

### 20 Code-Splitting & Lazy Loading** **Per-route / per-heavy-component

  ------------------ ---------------------------------------------------------
  **Field**          **Detail**

  **Input**          Bundle analysis (which chunks are oversized), route map,
                     list of components \> 20KB gzipped.

  **Output**         Updated import statements (React.lazy + dynamic
                     import()), Suspense boundary wrappers, updated
                     routing-config.

  **Correctness**    Each route loads ≤ 200KB JS gzipped on initial load (or
                     per spec\'d budget); lazy components have Suspense
                     fallbacks at correct granularity; loading states are not
                     jarring (skeleton or spinner per spec); split boundary
                     does not cause waterfall fetching (data fetch initiated
                     before bundle load); chunk names are human-readable
                     (webpackChunkName or rollupOptions.manualChunks); no
                     critical-path code accidentally deferred.

  **Dependencies**   react-page, routing-config compilers; bundle analysis
                     tooling.

  **Downstream**     performance-optimisation, e2e-test compilers.
  ------------------ ---------------------------------------------------------

### 21 Environment & Config Management** **Per-project / per-env

  ------------------ ---------------------------------------------------------
  **Field**          **Detail**

  **Input**          Environment variable list (name, type, secret/public
                     classification, per-env values), runtime config
                     requirements.

  **Output**         env.d.ts (typed import.meta.env or process.env),
                     .env.example (all vars documented, no values), zod env
                     schema, typed config.ts module.

  **Correctness**    No untyped string access of import.meta.env or
                     process.env anywhere in codebase; secrets never present
                     in client-side bundles (VITE_PUBLIC\_ prefix enforcement
                     for Vite; NEXT_PUBLIC\_ for Next.js); missing required
                     env var throws at startup (Zod parse fails loudly);
                     .env.\* files in .gitignore; .env.example committed with
                     all keys and documentation comments.

  **Dependencies**   ts-schema (Zod is used for env schema). Nothing else
                     depends on this first.

  **Downstream**     query-layer (API base URL), any compiler that needs
                     runtime config.
  ------------------ ---------------------------------------------------------

**22 Design System Integration** **Per-project onboarding /
per-DS-update**

  ------------------ ---------------------------------------------------------
  **Field**          **Detail**

  **Input**          Component library package (e.g., shadcn/ui, Radix, MUI),
                     version spec, theming API docs, design token mapping.

  **Output**         Provider wrapper component (ThemeProvider.tsx), theme
                     override config, barrel re-exports (components/index.ts),
                     optionally shadcn component scaffolding.

  **Correctness**    No direct imports from library internals (only public
                     API); theme tokens map 1:1 to design-token compiler
                     output; all library components wrapped in local barrel
                     (allows future library swap without touching consumer
                     components); peer dependency versions pinned; TypeScript
                     types re-exported correctly; provider correctly placed in
                     app tree (root but below router).

  **Dependencies**   design-token, react-component compilers.

  **Downstream**     All component and page compilers (they import from local
                     barrel, not library directly).
  ------------------ ---------------------------------------------------------

### 23 Mock / Fixture Authoring** **Per-feature

  ------------------ ---------------------------------------------------------
  **Field**          **Detail**

  **Input**          Data model (from ts-schema), edge case matrix (empty,
                     partial, max-length, error states), API endpoint list.

  **Output**         MSW handlers (handlers.ts), factory functions
                     (modelName.factory.ts using faker or custom), static
                     fixture JSON files.

  **Correctness**    Factories produce valid data that passes Zod schema
                     validation; all optional fields exercised across fixture
                     set; error response mocks include correct HTTP status
                     codes + typed error bodies; MSW handlers intercept all
                     real API calls in test environment (no accidental network
                     requests in tests); factories are seeded for
                     deterministic tests (faker.seed()); fixtures cover all
                     identified edge cases from spec.

  **Dependencies**   ts-schema (data shapes), query-layer (endpoint URLs for
                     MSW handlers).

  **Downstream**     unit-integration-test, storybook-story, e2e-test (all use
                     mocks for isolation).
  ------------------ ---------------------------------------------------------

### 24 Compound Component / Headless UI Pattern
**Per-reusable-component**

  ------------------ ---------------------------------------------------------
  **Field**          **Detail**

  **Input**          Complex interaction spec (e.g., Tabs, Accordion,
                     Combobox, DatePicker), accessibility pattern (WAI-ARIA
                     authoring practices), consumer API design.

  **Output**         Parent compound component + child sub-components
                     (Tabs.tsx, Tabs.List.tsx, Tabs.Tab.tsx, Tabs.Panel.tsx),
                     Context file, optionally headless hook (useTabs.ts).

  **Correctness**    Context is not exposed externally (implementation
                     detail); compound components fail clearly if used outside
                     parent context; WAI-ARIA pattern implemented correctly
                     (correct roles, aria-selected, aria-expanded,
                     aria-controls, etc.); keyboard navigation complete per
                     ARIA spec (arrow keys, Home, End, Enter); controlled and
                     uncontrolled modes both supported; TypeScript
                     discriminated props prevent invalid combinations (e.g.,
                     Tab without Panel).

  **Dependencies**   react-component (leaf atoms), react-hook (state
                     management), ts-schema (prop types).

  **Downstream**     storybook-story, a11y-audit, unit-integration-test
                     compilers.
  ------------------ ---------------------------------------------------------

### 25 Icon & Asset Pipeline** **Per-project / per-icon-batch

  ------------------ ---------------------------------------------------------
  **Field**          **Detail**

  **Input**          SVG icon files (design export), asset list (images,
                     fonts), optimisation spec (size budgets).

  **Output**         React icon components (Icon.tsx per icon or generated
                     sprite), optimised assets in /public or /assets, typed
                     asset imports (assets.d.ts if needed).

  **Correctness**    SVGs are optimised (SVGO, no embedded raster data, no
                     inline styles that block theming); icon components accept
                     size and color props that map to design tokens; no raster
                     images \> 200KB without explicit justification; images
                     use correct format (WebP for photos, SVG for
                     illustrations); fonts loaded with font-display: swap;
                     asset imports are typed (no string URLs cast to \'as
                     any\'); tree-shakeable (unused icons excluded from
                     bundle).

  **Dependencies**   design-token compiler (for icon sizing/colour tokens).

  **Downstream**     react-component, react-page (consume icons and assets),
                     performance-optimisation (asset size contributes to perf
                     budget).
  ------------------ ---------------------------------------------------------

## Recommended Compiler Build Order

The following phases define a dependency-respecting build sequence for
the full compiler network. Compilers within the same phase can be built
in parallel. Compilers in phase N must be complete before phase N+1
begins.

  ----------------- ------------------- ----------------------------- ----------------------------
  **Phase**         **Compiler Name**   **Depends On**                **Rationale**

  **0 ---           **ts-schema ✓       Nothing                       All other compilers
  Primitives**      EXISTS**                                          reference typed schemas.
                                                                      Must be built first.

                                        **design-token NEW**          ts-schema

                                        **env-config NEW**            ts-schema

  **1 --- Logic     **react-hook ✓      ts-schema                     Hooks encapsulate behaviour.
  Atoms**           EXISTS**                                          Forms, queries, stores all
                                                                      depend on hooks.

                                        **state-machine NEW**         ts-schema, react-hook

                                        **query-layer NEW**           ts-schema, react-hook

  **2 --- UI        **react-component ✓ design-token, ts-schema       Pure presentational leaf
  Atoms**           EXISTS**                                          components. Depend on
                                                                      tokens, not logic.

                                        **icon-asset NEW**            design-token

                                        **animation NEW**             react-component

  **3 --- UI        **react-form ✓      react-component, ts-schema,   Forms compose atoms + schema
  Molecules**       EXISTS**            react-hook                    validation + hooks.

                                        **compound-component NEW**    react-component, react-hook

                                        **error-boundary NEW**        react-component

                                        **a11y-audit NEW**            react-component, react-form

  **4 ---           **react-page ✓      react-component, react-form,  Pages assemble all lower
  Features**        EXISTS**            query-layer, state-machine,   atoms + routing + data.
                                        routing                       

                                        **routing-config NEW**        react-page (spec), ts-schema

                                        **i18n-setup NEW**            ts-schema, react-component

                                        **a-b-variant NEW**           react-component, react-page,
                                                                      feature-flag config

  **5 --- Quality   **storybook-story   react-component, react-form,  Stories document all
  Gates**           NEW**               animation                     component states; depend on
                                                                      full component tree.

                                        **unit-integration-test NEW** react-hook, react-component,
                                                                      react-form

                                        **e2e-test NEW**              react-page, routing-config

                                        **performance-optimisation    react-page, code-splitting,
                                        NEW**                         query-layer

                                        **code-splitting NEW**        react-page, routing-config

  **6 ---           **mock-fixture      ts-schema, query-layer        Mocks are typed per schema;
  Cross-Cutting**   NEW**                                             used by tests and Storybook.

                                        **css-styling NEW**           design-token

                                        **design-system-integration   react-component,
                                        NEW**                         design-token
  ----------------- ------------------- ----------------------------- ----------------------------

### Critical Path Summary

**The absolute critical path is:** ts-schema → design-token →
react-component → react-hook → react-form / query-layer / state-machine
→ react-page → e2e-test. Every other compiler is either on a parallel
branch or a quality-gate layer at the end.

### Compiler Interaction Map (Prose)

Phase 0 establishes the two orthogonal primitive layers: the type system
(ts-schema) and the visual vocabulary (design-token). These two have
zero dependencies between them and can be built simultaneously.

Phase 1 builds the logic atoms --- hooks, state machines, and query
wrappers --- all of which consume ts-schema for type safety but are
otherwise independent of any UI.

Phase 2 builds the UI atoms --- presentational leaf components, icons,
and animations --- which consume design tokens but are intentionally
free of data-fetching logic.

Phase 3 assembles molecules: forms (composing components + schema +
hooks), compound components (composing components + hooks), error
boundaries, and accessibility audits. These all assume the atoms are
stable.

Phase 4 builds features: pages (assembling all lower layers), routing
config, i18n, and A/B variants. This phase is the primary integration
point where data-fetching, state, routing, and UI converge.

Phase 5 is the quality gate layer: stories, unit tests, E2E tests,
performance optimisation, and code-splitting. These compilers consume
finished outputs from all prior phases and produce attestations of
correctness.

Phase 6 covers cross-cutting concerns (mocks, styling, design-system
integration) that feed multiple other phases. These can be partially
built early (mock-fixture and css-styling in parallel with Phase 1) and
extended incrementally.

*Domain Compiler Network --- Frontend Role Decomposition \| 25 Task
Types \| Engineering Research*
