Frontend Developer Role Decomposition
Summary Table

Task NameFrequencyInputOutputDefine TypeScript SchemaPer-featureData requirements spec (e.g., API response shapes, form data)TypeScript type/interface file (e.g., types.ts)Create Utility FunctionDailyFunctional requirement spec (e.g., string manipulation, date formatting)Utility function file (e.g., utils.ts)Create Constant/EnumPer-featureList of fixed values or optionsConstants file (e.g., constants.ts) or enum in types.tsCreate Zustand Store SlicePer-featureState management spec (e.g., fields, actions)Store slice file (e.g., userStore.ts)Create Redux SlicePer-featureState management spec (e.g., reducers, actions)Redux slice file (e.g., userSlice.ts)Create React Context ProviderPer-featureShared state/logic specContext provider file (e.g., ThemeContext.tsx)Create React HookDailyLogic encapsulation spec (e.g., useDebounce, useLocalStorage)Hook file (e.g., useCustomHook.ts)Create Query HookPer-featureData fetching spec (e.g., endpoint, params)Query hook file (e.g., useUserQuery.ts)Create Mutation HookPer-featureData mutation spec (e.g., POST endpoint, payload)Mutation hook file (e.g., useUpdateUserMutation.ts)Create React ComponentDailyUI element spec (e.g., props, behavior)Component file (e.g., Button.tsx)Create React FormPer-featureForm fields spec (e.g., validation rules)Form component file (e.g., LoginForm.tsx)Create Layout ComponentPer-projectLayout structure spec (e.g., header, sidebar)Layout file (e.g., MainLayout.tsx)Create Error BoundaryPer-featureError handling specError boundary component file (e.g., ErrorBoundary.tsx)Create Animation WrapperPer-featureAnimation spec (e.g., fade-in, transition)Animation component or hook (e.g., AnimateFade.tsx)Implement i18n SetupPer-projectLocalization spec (e.g., languages supported)i18n config file (e.g., i18n.ts) and initial translation files (e.g., en.json)Create Translation FilePer-featureTranslation keys and stringsLanguage file (e.g., fr.json)Define Design TokensPer-projectDesign system spec (e.g., colors, spacing)Tokens file (e.g., tokens.ts or theme.ts for Tailwind)Create A/B Test VariantPer-featureVariant spec (e.g., alternative UI)Variant component file (e.g., ButtonVariantA.tsx)Implement Accessibility FeaturesPer-featureA11y requirements spec (e.g., ARIA labels)Updated component files with a11y props/attributesCreate React PagePer-featurePage composition spec (e.g., components to include)Page file (e.g., HomePage.tsx)Configure Router RoutePer-featureRouting spec (e.g., path, component)Updated router config file (e.g., routes.ts or app.tsx in Next.js)
Detailed Breakdown Per Task
Define TypeScript Schema

Name: Define TypeScript Schema
Frequency: Per-feature
Input: Data requirements spec (e.g., API response shapes, form data structures, often in natural language or JSON examples)
Output: TypeScript type/interface file (e.g., types.ts containing interfaces like User or Product)
Correctness criteria: Types must compile without errors; cover all specified fields with correct primitives (string, number, etc.); include optional/required modifiers accurately; no unused types; validated against sample data if provided (e.g., via type assertion)
Dependencies: None (base level)
Downstream consumers: Create Utility Function, Create React Hook, Create Query Hook, Create Mutation Hook, Create React Component, Create React Form, Create Zustand Store Slice, Create Redux Slice

Create Utility Function

Name: Create Utility Function
Frequency: Daily
Input: Functional requirement spec (e.g., "format date as YYYY-MM-DD", "debounce function")
Output: Utility function file (e.g., utils.ts with exported functions like formatDate)
Correctness criteria: Function passes unit tests for specified inputs/outputs; types are inferred or explicitly defined; no side effects unless specified; handles edge cases (e.g., null inputs); exported correctly
Dependencies: Define TypeScript Schema (if using custom types)
Downstream consumers: Create React Hook, Create React Component, Create Query Hook, Create Mutation Hook, Create Zustand Store Slice, Create Redux Slice

Create Constant/Enum

Name: Create Constant/Enum
Frequency: Per-feature
Input: List of fixed values or options (e.g., user roles: admin, user)
Output: Constants file (e.g., constants.ts with const ROLES = { ADMIN: 'admin' }) or enum in types.ts
Correctness criteria: Values are unique and match spec; types are string literals or numbers; exported; no typos in keys/values
Dependencies: None
Downstream consumers: Create Utility Function, Create React Component, Create React Form, Create Zustand Store Slice, Create Redux Slice, Create Query Hook

Create Zustand Store Slice

Name: Create Zustand Store Slice
Frequency: Per-feature
Input: State management spec (e.g., initial state, setters, async actions)
Output: Store slice file (e.g., userStore.ts with create() from zustand)
Correctness criteria: Store initializes correctly; actions update state immutably; types match schemas; handles async if needed; subscribable
Dependencies: Define TypeScript Schema, Create Utility Function
Downstream consumers: Create React Hook, Create React Component, Create React Page, Create Query Hook, Create Mutation Hook

Create Redux Slice

Name: Create Redux Slice
Frequency: Per-feature
Input: State management spec (e.g., reducers, extraReducers for thunks)
Output: Redux slice file (e.g., userSlice.ts with createSlice from @reduxjs/toolkit)
Correctness criteria: Reducers pure and immutable; actions typed; integrates with store; handles pending/fulfilled/rejected for async
Dependencies: Define TypeScript Schema, Create Utility Function
Downstream consumers: Create React Hook, Create React Component, Create React Page, Create Query Hook, Create Mutation Hook

Create React Context Provider

Name: Create React Context Provider
Frequency: Per-feature
Input: Shared state/logic spec (e.g., theme toggler)
Output: Context provider file (e.g., ThemeContext.tsx with createContext and Provider component)
Correctness criteria: Context value typed; provider wraps children; useContext hook works; no unnecessary re-renders
Dependencies: Define TypeScript Schema, Create Utility Function, Create React Hook
Downstream consumers: Create React Component, Create React Page, Create Layout Component

Create React Hook

Name: Create React Hook
Frequency: Daily
Input: Logic encapsulation spec (e.g., useEffect-based timer)
Output: Hook file (e.g., useCustomHook.ts returning state/effects)
Correctness criteria: Follows rules of hooks; cleanup effects; memoized dependencies; typed return value; handles mounting/unmounting
Dependencies: Define TypeScript Schema, Create Utility Function
Downstream consumers: Create React Component, Create React Form, Create Query Hook, Create Mutation Hook, Create React Page

Create Query Hook

Name: Create Query Hook
Frequency: Per-feature
Input: Data fetching spec (e.g., endpoint, query key, params using React Query or SWR)
Output: Query hook file (e.g., useUserQuery.ts with useQuery)
Correctness criteria: Query key unique; staleTime/cacheTime set; error handling; typed data; refetch on conditions
Dependencies: Define TypeScript Schema, Create Utility Function, Create React Hook
Downstream consumers: Create React Component, Create React Page, Create React Form

Create Mutation Hook

Name: Create Mutation Hook
Frequency: Per-feature
Input: Data mutation spec (e.g., POST/PUT, optimistic updates)
Output: Mutation hook file (e.g., useUpdateUserMutation.ts with useMutation)
Correctness criteria: Mutation fn async; onSuccess/onError handlers; invalidates queries; typed variables/result
Dependencies: Define TypeScript Schema, Create Utility Function, Create React Hook
Downstream consumers: Create React Component, Create React Page, Create React Form

Create React Component

Name: Create React Component
Frequency: Daily
Input: UI element spec (e.g., props, JSX structure, Tailwind classes)
Output: Component file (e.g., Button.tsx with FC or function component)
Correctness criteria: Renders without errors; props typed; memoized if pure; handles states; Tailwind classes valid; responsive
Dependencies: Define TypeScript Schema, Create Utility Function, Create React Hook, Define Design Tokens
Downstream consumers: Create React Form, Create Layout Component, Create React Page, Create Error Boundary, Create Animation Wrapper, Create A/B Test Variant

Create React Form

Name: Create React Form
Frequency: Per-feature
Input: Form fields spec (e.g., inputs, validation with react-hook-form or similar)
Output: Form component file (e.g., LoginForm.tsx)
Correctness criteria: Validation rules applied; submission handler; error messages; typed form values; accessible labels
Dependencies: Create React Component, Create React Hook, Create Mutation Hook
Downstream consumers: Create React Page

Create Layout Component

Name: Create Layout Component
Frequency: Per-project
Input: Layout structure spec (e.g., slots for header, content)
Output: Layout file (e.g., MainLayout.tsx composing other components)
Correctness criteria: Renders children; responsive breakpoints; integrates router outlets if needed
Dependencies: Create React Component, Create React Context Provider
Downstream consumers: Create React Page, Configure Router Route

Create Error Boundary

Name: Create Error Boundary
Frequency: Per-feature
Input: Error handling spec (e.g., fallback UI)
Output: Error boundary component file (e.g., ErrorBoundary.tsx extending Component)
Correctness criteria: Catches errors in children; renders fallback; resets on key change; logs errors
Dependencies: Create React Component
Downstream consumers: Create React Page, Create Layout Component

Create Animation Wrapper

Name: Create Animation Wrapper
Frequency: Per-feature
Input: Animation spec (e.g., variants for enter/exit using framer-motion)
Output: Animation component or hook (e.g., AnimateFade.tsx with motion.div)
Correctness criteria: Animations smooth; performance optimized; accessible (reduced motion); triggers on mount/update
Dependencies: Create React Component, Create React Hook
Downstream consumers: Create React Component, Create React Page

Implement i18n Setup

Name: Implement i18n Setup
Frequency: Per-project
Input: Localization spec (e.g., i18next or react-i18next config)
Output: i18n config file (e.g., i18n.ts) and initial translation files (e.g., en.json)
Correctness criteria: Detects language; loads resources; interpolation works; pluralization handled
Dependencies: None
Downstream consumers: Create Translation File, Create React Component, Create React Page

Create Translation File

Name: Create Translation File
Frequency: Per-feature
Input: Translation keys and strings (e.g., key: "Welcome")
Output: Language file (e.g., fr.json with nested objects)
Correctness criteria: JSON valid; all keys unique; covers all languages; no missing translations
Dependencies: Implement i18n Setup
Downstream consumers: Create React Component, Create React Page

Define Design Tokens

Name: Define Design Tokens
Frequency: Per-project
Input: Design system spec (e.g., colors: primary #0070f3)
Output: Tokens file (e.g., tokens.ts or extended Tailwind config)
Correctness criteria: Tokens typed; consistent naming; covers themes (light/dark); integrates with Tailwind
Dependencies: None
Downstream consumers: Create React Component, Create Layout Component

Create A/B Test Variant

Name: Create A/B Test Variant
Frequency: Per-feature
Input: Variant spec (e.g., alternative props or structure, using a library like react-ab)
Output: Variant component file (e.g., ButtonVariantA.tsx)
Correctness criteria: Renders based on experiment flag; metrics tracked; fallback to default; no performance hit
Dependencies: Create React Component
Downstream consumers: Create React Page

Implement Accessibility Features

Name: Implement Accessibility Features
Frequency: Per-feature
Input: A11y requirements spec (e.g., add aria-label, keyboard nav)
Output: Updated component files with a11y props/attributes (e.g., in Button.tsx)
Correctness criteria: Passes axe-core or similar audit; semantic HTML; focus management; screen reader compatible
Dependencies: Create React Component, Create React Form
Downstream consumers: Create React Page, accessibility audits (though audits are excluded, features feed into final artifacts)

Create React Page

Name: Create React Page
Frequency: Per-feature
Input: Page composition spec (e.g., components, hooks to use)
Output: Page file (e.g., HomePage.tsx composing components)
Correctness criteria: Renders without hydration errors; data fetched; SEO meta if Next.js; protected routes if needed
Dependencies: Create React Component, Create React Hook, Create Query Hook, Create Layout Component, Create Error Boundary
Downstream consumers: Configure Router Route

Configure Router Route

Name: Configure Router Route
Frequency: Per-feature
Input: Routing spec (e.g., path: '/home', element: <HomePage />)
Output: Updated router config file (e.g., routes.ts or app.tsx in Next.js)
Correctness criteria: Routes unique; lazy loading; params typed; guards/redirects work; no conflicts
Dependencies: Create React Page, Create Layout Component
Downstream consumers: None (end of chain)

Recommended Build Order for Compiler Network
Considering the dependency graph, build compilers in an order that resolves prerequisites first. Start with base-level tasks with no dependencies, then progress to those that depend on them. The existing compilers (ts-schema for Define TypeScript Schema, react-component, react-form, react-hook, react-page) can be assumed as starting points. Recommended order:

Define TypeScript Schema (existing: ts-schema)
Create Constant/Enum (no deps)
Implement i18n Setup (no deps)
Define Design Tokens (no deps)
Create Utility Function (deps: 1)
Create React Hook (existing: react-hook; deps: 1,5)
Create React Context Provider (deps: 1,5,6)
Create Zustand Store Slice (deps: 1,5)
Create Redux Slice (deps: 1,5)
Create Query Hook (deps: 1,5,6)
Create Mutation Hook (deps: 1,5,6)
Create React Component (existing: react-component; deps: 1,5,6,4)
Create Animation Wrapper (deps: 12,6)
Create Error Boundary (deps: 12)
Create A/B Test Variant (deps: 12)
Implement Accessibility Features (deps: 12, and existing react-form if forms involved)
Create Translation File (deps: 3)
Create Layout Component (deps: 12,7)
Create React Form (existing: react-form; deps: 12,6,11)
Create React Page (existing: react-page; deps: 12,6,10,18,14)
Configure Router Route (deps: 20,18)
