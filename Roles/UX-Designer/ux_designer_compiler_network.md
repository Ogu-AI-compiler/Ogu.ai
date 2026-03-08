# UX Designer Compiler Network
> Domain Compiler Network — UX Designer Role Decomposition
> Generated for: formal compiler network build planning
> Excludes already-built and shared/cross-role compilers

---

## Summary Table

| Task Name (Compiler ID) | Frequency | Input | Output |
|---|---|---|---|
| `sitemap` | per-project | Product scope, user roles, route inventory | `sitemap.json` |
| `information-architecture` | per-project | Content inventory, user mental models, sitemap | `ia-spec.json` |
| `user-flow` | per-feature | User goal, entry points, route list, auth policy | `user-flow.json` |
| `task-flow` | per-feature | Specific task definition, actor, system actions | `task-flow.json` |
| `navigation-spec` | per-project | Sitemap, route list, permission matrix, user roles | `navigation-spec.json` |
| `state-matrix` | per-feature | Page/component list, data queries, error types | `state-matrix.json` |
| `form-flow-spec` | per-feature | Form fields, validation rules, multi-step config | `form-flow-spec.json` |
| `multi-step-flow-spec` | per-feature | Step list, branching logic, completion criteria | `multi-step-flow-spec.json` |
| `onboarding-flow-spec` | per-project | User roles, first-run goals, feature set | `onboarding-flow-spec.json` |
| `returning-user-flow-spec` | per-project | Session state, persisted data, re-entry points | `returning-user-flow-spec.json` |
| `permission-ux-branch-spec` | per-feature | Auth policy, role list, page/feature map | `permission-ux-spec.json` |
| `empty-state-spec` | per-feature | Data model, trigger conditions, recovery actions | `empty-state-spec.json` |
| `error-recovery-spec` | per-feature | Error taxonomy, failure surfaces, recovery paths | `error-recovery-spec.json` |
| `destructive-action-spec` | per-feature | Action list, irreversibility flags, undo windows | `destructive-action-spec.json` |
| `search-filter-sort-spec` | per-feature | Data model, filterable fields, sort options | `search-filter-sort-spec.json` |
| `data-table-interaction-spec` | per-feature | Table schema, row actions, pagination config | `data-table-spec.json` |
| `dashboard-hierarchy-spec` | per-feature | Widget list, data sources, user role map | `dashboard-hierarchy-spec.json` |
| `wireframe-manifest` | per-feature | Screen list, state matrix, flow specs | `wireframe-manifest.json` |
| `copy-structure-spec` | per-feature | Content inventory, i18n keys, interpolation rules | `copy-structure-spec.json` |
| `responsive-structure-spec` | per-feature | Breakpoints, layout regions, reflow rules | `responsive-structure-spec.json` |
| `rtl-structure-spec` | per-project | Layout spec, component list, locale list | `rtl-spec.json` |
| `localization-flow-constraint-spec` | per-project | Locale list, string expansion factors, layout rules | `l10n-flow-spec.json` |
| `experiment-variant-flow-spec` | per-experiment | Feature flag config, variant definitions, goal events | `experiment-variant-spec.json` |
| `journey-map-spec` | per-project | User research data, touchpoint inventory, phases | `journey-map-spec.json` |
| `route-guard-spec` | per-feature | Route list, auth states, redirect rules | `route-guard-spec.json` |
| `abandoned-flow-recovery-spec` | per-feature | Multi-step flow spec, persistence model, re-entry | `abandoned-flow-spec.json` |
| `offline-state-spec` | per-feature | Network-dependent actions, cache strategy, sync | `offline-state-spec.json` |
| `handoff-annotation-spec` | per-feature | Wireframe manifest, flow specs, state matrix | `handoff-annotation-spec.json` |
| `usability-test-script-spec` | per-experiment | User flows, task flows, hypothesis | `usability-test-spec.json` |
| `ux-audit-report` | daily | Existing flow specs, route list, state matrices | `ux-audit-report.json` |

---

## Detailed Breakdown

---

### 1. `sitemap`

**Frequency:** per-project

**Input:**
- Product scope document
- User role list
- Route inventory (from `api-route` and `react-page` if available)
- Navigation hierarchy requirements

**Output:**
- `sitemap.json` — hierarchical map of all screens/routes: node ID, label, parent, depth, visibility (public/auth/role-gated), route reference

**Spec file:** `sitemap.spec.json`
```json
{
  "nodes": [
    { "id": "home", "label": "Home", "parent": null, "route": "/", "visibility": "public" },
    { "id": "dashboard", "label": "Dashboard", "parent": null, "route": "/dashboard", "visibility": "authenticated" }
  ]
}
```

**Correctness Gates:**
1. Every node has a unique `id` and a non-empty `label`
2. Every non-root node references a `parent` that exists in the node list
3. Every `route` value references an existing route artifact or is flagged `planned`
4. No circular parent-child relationships exist
5. Every authenticated node has a `visibility` value of `authenticated` or a named role
6. Root-level nodes (depth 0) do not exceed a configurable maximum (default: 10)
7. Sitemap is a valid directed acyclic graph (DAG)

**Error Codes:**
- `UX001` — Orphaned node: parent ID not found
- `UX002` — Duplicate node ID
- `UX003` — Route reference not found in route artifact registry
- `UX004` — Circular parent reference detected
- `UX005` — Authenticated node missing visibility declaration

**Key Invariant:** Compiler must fail if any node's `route` references a path not present in the known route registry and is not flagged `planned`.

**Safe Default:** Without a sitemap, navigation-spec and user-flow compilers cannot validate route coverage; all downstream compilers must treat all routes as unverified.

**Dependencies:**
- Route inventory (`react-page`, `api-route` — already built)
- Product scope / role definitions (external input)

**Downstream Consumers:**
- `information-architecture`
- `navigation-spec`
- `user-flow`
- `route-guard-spec`

---

### 2. `information-architecture`

**Frequency:** per-project

**Input:**
- `sitemap.json`
- Content inventory (content types, entities, relationships)
- User mental model research notes (structured)
- Search/filter surface list

**Output:**
- `ia-spec.json` — structured IA: content groupings, labeling system, navigation taxonomy, global vs local nav zones, search surface definitions

**Spec file:** `ia-spec.spec.json`

**Correctness Gates:**
1. Every content type in the inventory appears in at least one IA grouping
2. Every IA grouping maps to at least one sitemap node
3. Labels are unique within the same navigation level
4. Global nav items are a subset of root-level sitemap nodes
5. Every search surface has a defined scope (global / section / entity-type)
6. No IA grouping references a sitemap node that does not exist

**Error Codes:**
- `UX010` — Content type not assigned to any IA group
- `UX011` — IA group references non-existent sitemap node
- `UX012` — Duplicate label at same navigation depth
- `UX013` — Search surface has undefined scope
- `UX014` — Global nav item not in root-level sitemap nodes

**Key Invariant:** Compiler must fail if any IA group maps to a sitemap node marked `planned` without an explicit `provisional: true` flag.

**Safe Default:** Without IA spec, navigation-spec will have no validated labeling or grouping taxonomy, causing potential navigation inconsistencies across features.

**Dependencies:**
- `sitemap.json`

**Downstream Consumers:**
- `navigation-spec`
- `search-filter-sort-spec`
- `dashboard-hierarchy-spec`
- `copy-structure-spec`

---

### 3. `user-flow`

**Frequency:** per-feature

**Input:**
- User goal statement
- Actor/role definition
- Entry point list (URLs, notifications, external links)
- Exit point list (success states, failure states, abandonment)
- Route list from `sitemap.json`
- Auth policy from `authz-policy` or `auth-middleware`

**Output:**
- `user-flow.json` — directed graph of screens and decision nodes: node (screen/decision/terminal), edges (transitions with trigger condition), entry nodes, terminal nodes (success/failure/abandoned)

**Spec file:** `user-flow.spec.json`

**Correctness Gates:**
1. Every flow has at least one entry node and at least one terminal node
2. Every terminal node is classified: `success` | `failure` | `abandoned` | `external`
3. Every screen node references a sitemap node ID
4. Every decision node has at least two outgoing edges
5. Every edge has a `trigger` (user action or system event) defined
6. No node is unreachable from all entry nodes
7. Every path from entry to terminal is finite (no infinite loops without an exit edge)
8. Authenticated entry points reference the route-guard-spec for the associated route
9. Cross-compiler: every screen node must resolve to an existing `react-page` artifact or be flagged `planned`

**Error Codes:**
- `UX020` — Terminal node missing classification
- `UX021` — Screen node references non-existent sitemap node
- `UX022` — Decision node has fewer than two outgoing edges
- `UX023` — Unreachable node detected
- `UX024` — Edge missing trigger definition

**Key Invariant:** Compiler must fail if any path through the flow can reach a dead end (no outgoing edges) that is not a classified terminal node.

**Safe Default:** Without a user-flow spec, developers implement screen transitions without a validated state graph, causing unhandled navigation dead ends.

**Dependencies:**
- `sitemap.json`
- `permission-ux-branch-spec` (for role-gated branches)
- `route-guard-spec`

**Downstream Consumers:**
- `task-flow`
- `state-matrix`
- `wireframe-manifest`
- `handoff-annotation-spec`
- `usability-test-script-spec`

---

### 4. `task-flow`

**Frequency:** per-feature

**Input:**
- Task definition (specific micro-interaction or sub-goal)
- Parent `user-flow.json`
- System actions / backend calls involved
- Actor role

**Output:**
- `task-flow.json` — step-by-step task sequence: actor steps, system responses, decision points, validation checkpoints, and outcome states

**Spec file:** `task-flow.spec.json`

**Correctness Gates:**
1. Every task-flow step is typed: `user-action` | `system-response` | `validation` | `decision`
2. Every `system-response` step references the triggering `user-action` step
3. Every `validation` step has a defined pass condition and fail condition
4. Task flow maps to at least one parent `user-flow` node sequence
5. Every outcome state is classified: `success` | `error` | `blocked` | `pending`
6. No step references a system call not present in the known API surface

**Error Codes:**
- `UX030` — Step type missing or invalid
- `UX031` — System-response step without triggering user-action
- `UX032` — Validation step missing pass/fail conditions
- `UX033` — Outcome state not classified
- `UX034` — System call reference not in API surface

**Key Invariant:** Compiler must fail if any validation step has a fail condition with no corresponding recovery or error path.

**Safe Default:** Without task-flow, form-flow-spec and multi-step-flow compilers lack atomic step definitions, resulting in underspecified interaction logic.

**Dependencies:**
- `user-flow.json`
- `openapi-spec` (for system call references — already built)

**Downstream Consumers:**
- `form-flow-spec`
- `multi-step-flow-spec`
- `state-matrix`
- `handoff-annotation-spec`

---

### 5. `navigation-spec`

**Frequency:** per-project

**Input:**
- `sitemap.json`
- `ia-spec.json`
- Permission matrix / role list
- `route-guard-spec.json`
- Mobile/desktop navigation pattern requirements

**Output:**
- `navigation-spec.json` — navigation structure definition: global nav, local nav, contextual nav, breadcrumb rules, back-navigation behavior, deep-link support, role-based nav item visibility

**Spec file:** `navigation-spec.spec.json`

**Correctness Gates:**
1. Every global nav item references a valid sitemap node
2. Every role-gated nav item references an existing role in the permission matrix
3. Back-navigation behavior is defined for every screen (browser-back / custom / disabled)
4. Breadcrumb rules are defined for every sitemap depth ≥ 2
5. Deep-link behavior is defined for every authenticated route (redirect-to-login / preserve-destination / deny)
6. No nav item references a route not present in `sitemap.json`
7. Cross-compiler: every `visibility: role-gated` nav item maps to a matching entry in `permission-ux-branch-spec`

**Error Codes:**
- `UX040` — Nav item references non-existent sitemap node
- `UX041` — Role-gated nav item references undefined role
- `UX042` — Back-navigation behavior undefined for screen
- `UX043` — Deep-link behavior undefined for authenticated route
- `UX044` — Breadcrumb rule missing for depth ≥ 2 node

**Key Invariant:** Compiler must fail if any nav item is visible to a role that lacks access to the referenced route per `route-guard-spec`.

**Safe Default:** Without navigation-spec, nav components are implemented without validated role-visibility or back-navigation rules, causing unauthorized link exposure.

**Dependencies:**
- `sitemap.json`
- `ia-spec.json`
- `permission-ux-branch-spec`
- `route-guard-spec`

**Downstream Consumers:**
- `wireframe-manifest`
- `handoff-annotation-spec`
- `onboarding-flow-spec`

---

### 6. `state-matrix`

**Frequency:** per-feature

**Input:**
- Screen / component list
- Data query list (from `api-route` or `openapi-spec`)
- Error type taxonomy
- Permission states per screen
- Partial data scenarios

**Output:**
- `state-matrix.json` — per-screen state coverage matrix: state type (loading / empty / partial / error / success / offline / permission-denied), trigger condition, UI response, recovery action

**Spec file:** `state-matrix.spec.json`

**Correctness Gates:**
1. Every screen with a data dependency has all four core states defined: `loading`, `empty`, `error`, `success`
2. Every `error` state has a recovery action defined (retry / redirect / contact-support)
3. Every `empty` state has a call-to-action or explanation defined
4. Every screen accessible to multiple roles has a `permission-denied` state
5. Every state has a UI response description (not empty)
6. `partial` data state is defined for any screen that can render with incomplete data
7. `offline` state is defined for any screen with network-dependent content
8. Cross-compiler: every data query in `openapi-spec` that feeds a screen has a corresponding `error` and `loading` state in the matrix

**Error Codes:**
- `UX050` — Screen missing required state (loading/empty/error/success)
- `UX051` — Error state has no recovery action
- `UX052` — Empty state has no call-to-action
- `UX053` — Multi-role screen missing permission-denied state
- `UX054` — Data query not covered by state matrix

**Key Invariant:** Compiler must fail if any screen has a data dependency but no `loading` state defined.

**Safe Default:** Without state-matrix, developers implement only the happy path, leaving loading/error/empty states unhandled and causing blank screens in production.

**Dependencies:**
- `user-flow.json`
- `task-flow.json`
- `openapi-spec` (already built)
- `permission-ux-branch-spec`

**Downstream Consumers:**
- `wireframe-manifest`
- `empty-state-spec`
- `error-recovery-spec`
- `offline-state-spec`
- `handoff-annotation-spec`

---

### 7. `form-flow-spec`

**Frequency:** per-feature

**Input:**
- Form field definitions
- Validation rules per field
- Submission behavior
- Multi-step config (if applicable)
- Error message map
- `react-form` artifact (already built, for cross-check)

**Output:**
- `form-flow-spec.json` — form behavior spec: field list, validation trigger (on-blur / on-change / on-submit), inline error placement, submission states (idle / submitting / success / error), field dependencies, conditional field display rules

**Spec file:** `form-flow-spec.spec.json`

**Correctness Gates:**
1. Every field has a defined validation trigger
2. Every field has at least one defined error message
3. Every conditional field has an explicit show/hide condition referencing another field
4. Submission states include all four: `idle`, `submitting`, `success`, `error`
5. Error placement is defined for every field (inline / summary / toast)
6. Cross-compiler: every field in spec maps to a field in the corresponding `react-form` artifact (names must match)
7. Cross-compiler: every validation rule aligns with the `ts-schema` validation for the same form
8. Multi-step forms reference a `multi-step-flow-spec` ID

**Error Codes:**
- `UX060` — Field missing validation trigger
- `UX061` — Field missing error message
- `UX062` — Conditional field show/hide references non-existent field
- `UX063` — Submission success state not defined
- `UX064` — Field name mismatch with react-form artifact

**Key Invariant:** Compiler must fail if any required field has no defined error state for validation failure.

**Safe Default:** Without form-flow-spec, form error handling and conditional logic are implemented inconsistently across features.

**Dependencies:**
- `task-flow.json`
- `react-form` (already built — cross-check only)
- `ts-schema` (already built — cross-check only)
- `copy-structure-spec` (for error message text)

**Downstream Consumers:**
- `multi-step-flow-spec`
- `wireframe-manifest`
- `handoff-annotation-spec`

---

### 8. `multi-step-flow-spec`

**Frequency:** per-feature

**Input:**
- Step list with titles and content descriptions
- Branching logic (condition → step skip or redirect)
- Completion criteria per step
- Back-navigation rules
- Progress indicator requirements
- Abandonment behavior

**Output:**
- `multi-step-flow-spec.json` — step sequence definition: step ID, title, content type, entry condition, completion condition, back-allowed flag, skip condition, exit behavior (abandon / save-draft / submit)

**Spec file:** `multi-step-flow-spec.spec.json`

**Correctness Gates:**
1. Every step has a unique `step_id`
2. Every step has a defined `completion_condition` (binary expression)
3. `back_allowed` is explicitly declared per step (not assumed)
4. Every branch condition references a field or state that exists in the flow
5. Terminal step has `exit_behavior: submit` defined
6. Every non-terminal step has a defined `next_step` (or conditional `next_step` map)
7. Progress indicator step count matches total step count in spec
8. `abandoned-flow-recovery-spec` is referenced if abandonment is possible

**Error Codes:**
- `UX070` — Step missing completion condition
- `UX071` — Branch condition references non-existent field
- `UX072` — Non-terminal step has no next_step defined
- `UX073` — Terminal step missing exit behavior
- `UX074` — Step count mismatch with progress indicator

**Key Invariant:** Compiler must fail if any step's `entry_condition` can never be satisfied given the preceding step's completion conditions.

**Safe Default:** Without multi-step-flow-spec, step order, skip logic, and abandonment handling are ad-hoc per implementation.

**Dependencies:**
- `form-flow-spec.json` (for form-based steps)
- `task-flow.json`
- `abandoned-flow-recovery-spec` (soft dependency)

**Downstream Consumers:**
- `wireframe-manifest`
- `onboarding-flow-spec`
- `handoff-annotation-spec`
- `abandoned-flow-recovery-spec`

---

### 9. `onboarding-flow-spec`

**Frequency:** per-project

**Input:**
- User role list
- First-run feature set (what must be seen/done on first login)
- Completion criteria (what constitutes completed onboarding)
- Skip/defer options
- Re-trigger conditions

**Output:**
- `onboarding-flow-spec.json` — per-role onboarding sequence: steps, completion checkpoints, skip conditions, re-entry triggers, success state definition, graceful degradation if skipped

**Spec file:** `onboarding-flow-spec.spec.json`

**Correctness Gates:**
1. Every user role has a defined onboarding sequence (or explicit `onboarding: none` declaration)
2. Every step has a `completion_checkpoint` (how the system knows it's done)
3. Skip behavior is explicitly defined: `skippable: true | false`
4. Re-trigger conditions are defined (e.g., "if step X never completed after 7 days")
5. Success state is defined with what changes in UX post-completion
6. Onboarding sequence does not reference screens not in `sitemap.json`
7. Cross-compiler: onboarding route must exist in `route-guard-spec` with `first_run_only: true` flag

**Error Codes:**
- `UX080` — Role has no onboarding sequence defined
- `UX081` — Step missing completion checkpoint
- `UX082` — Onboarding screen not in sitemap
- `UX083` — Re-trigger condition undefined
- `UX084` — Success state not defined

**Key Invariant:** Compiler must fail if any mandatory onboarding step has no completion checkpoint, making completion undetectable.

**Safe Default:** Without onboarding-flow-spec, first-time users receive no guided path and may abandon before reaching activation.

**Dependencies:**
- `sitemap.json`
- `navigation-spec.json`
- `multi-step-flow-spec.json`
- `permission-ux-branch-spec.json`
- `route-guard-spec.json`

**Downstream Consumers:**
- `returning-user-flow-spec`
- `wireframe-manifest`

---

### 10. `returning-user-flow-spec`

**Frequency:** per-project

**Input:**
- Session state model (what is persisted between sessions)
- Re-entry points (direct URL, notification, email link)
- Onboarding completion status
- Last-active state restoration requirements

**Output:**
- `returning-user-flow-spec.json` — re-entry behavior spec: session restore rules, redirect logic by completion state, notification deep-link handling, stale-state detection and recovery

**Spec file:** `returning-user-flow-spec.spec.json`

**Correctness Gates:**
1. Every re-entry point has a defined destination (route + state)
2. Session restore behavior is defined: `restore` | `reset` | `prompt`
3. Stale-state scenarios are enumerated (e.g., resource deleted since last session)
4. Notification deep-links are validated against `sitemap.json` routes
5. Onboarding-incomplete re-entry behavior is defined
6. Every stale-state scenario has a recovery path defined

**Error Codes:**
- `UX090` — Re-entry point has no defined destination
- `UX091` — Notification deep-link references non-existent route
- `UX092` — Stale-state scenario has no recovery path
- `UX093` — Session restore behavior undefined
- `UX094` — Onboarding-incomplete re-entry path not defined

**Key Invariant:** Compiler must fail if any notification deep-link destination is not present in `sitemap.json`.

**Safe Default:** Without returning-user-flow-spec, re-entry behavior is undefined, causing users to land on incorrect or broken states.

**Dependencies:**
- `onboarding-flow-spec.json`
- `sitemap.json`
- `route-guard-spec.json`

**Downstream Consumers:**
- `wireframe-manifest`
- `handoff-annotation-spec`

---

### 11. `permission-ux-branch-spec`

**Frequency:** per-feature

**Input:**
- Auth policy / role list (from `authz-policy` or `auth-middleware`)
- Screen and feature list
- Role-specific UX variants (what changes per role)
- Upgrade/upsell prompt requirements

**Output:**
- `permission-ux-spec.json` — per-screen/feature permission branching: role → visible elements, role → hidden elements, role → disabled elements, upgrade prompt trigger conditions, graceful degradation rules

**Spec file:** `permission-ux-spec.spec.json`

**Correctness Gates:**
1. Every role in the auth policy has a corresponding branch rule for every gated screen/feature
2. Every hidden element has a defined substitute (hidden silently / replaced by upgrade prompt / shown as disabled)
3. Upgrade prompt conditions are binary (trigger when `role !== 'pro'`, not vague)
4. No branch rule grants UI access to a role that is denied at the route level in `route-guard-spec`
5. Admin-only UI elements are enumerated and isolated from regular-user branches
6. Cross-compiler: every role in this spec exists in the `authz-policy` artifact
7. M2M / service accounts have defined UX branch rules if they can trigger UI flows

**Error Codes:**
- `UX100` — Role not defined in auth policy but present in branch spec
- `UX101` — Hidden element has no defined substitute behavior
- `UX102` — Branch spec grants UI access denied at route level
- `UX103` — Upgrade prompt trigger not a binary condition
- `UX104` — Admin-only element not isolated in branch rules

**Key Invariant:** Compiler must fail if any branch rule grants visibility to a UI element that the corresponding `authz-policy` denies access to at the data level.

**Safe Default:** Without permission-ux-branch-spec, UI elements are shown to all roles, leaking admin controls or gated features.

**Dependencies:**
- `authz-policy` (security compiler)
- `route-guard-spec.json`
- `sitemap.json`

**Downstream Consumers:**
- `navigation-spec`
- `state-matrix`
- `user-flow`
- `wireframe-manifest`

---

### 12. `empty-state-spec`

**Frequency:** per-feature

**Input:**
- Data model (what can be empty)
- Trigger conditions (first use / filtered out / deleted all / error-induced)
- Available actions from empty state
- `state-matrix.json` (empty state entries)

**Output:**
- `empty-state-spec.json` — per-surface empty state definition: trigger condition, headline copy key, body copy key, CTA action (route or action ID), illustration flag, empty-vs-error disambiguation rule

**Spec file:** `empty-state-spec.spec.json`

**Correctness Gates:**
1. Every list, table, or dashboard widget has an empty state entry
2. Every empty state has a trigger condition (not just "no data")
3. Every empty state distinguishes between first-use-empty and filtered-empty
4. Every empty state with a CTA references a valid route or action in the system
5. Copy key references exist in `copy-structure-spec`
6. Error-induced empty states are disambiguated from true empty states

**Error Codes:**
- `UX110` — Surface missing empty state definition
- `UX111` — Trigger condition is not specific (generic "no data" not accepted)
- `UX112` — CTA references non-existent route or action
- `UX113` — Copy key not found in copy-structure-spec
- `UX114` — Error-induced empty state not disambiguated from true empty

**Key Invariant:** Compiler must fail if any list or data surface has no empty state defined.

**Safe Default:** Without empty-state-spec, empty states render as blank screens or raw "no results" text with no recovery path.

**Dependencies:**
- `state-matrix.json`
- `copy-structure-spec.json`
- `user-flow.json`

**Downstream Consumers:**
- `wireframe-manifest`
- `handoff-annotation-spec`

---

### 13. `error-recovery-spec`

**Frequency:** per-feature

**Input:**
- Error taxonomy (4xx, 5xx, network, validation, permission, timeout)
- Feature-specific failure surfaces
- Recovery action inventory (retry / redirect / contact-support / undo)
- `state-matrix.json` (error state entries)

**Output:**
- `error-recovery-spec.json` — per-error-type recovery definition: error code/type, user-facing message key, recovery action, retry behavior (max retries, backoff), escalation path, persistence (transient / persistent)

**Spec file:** `error-recovery-spec.spec.json`

**Correctness Gates:**
1. Every error type in the taxonomy has a recovery spec entry
2. Every recovery action references a valid route, action, or external link
3. Retry behavior is defined for every network/timeout error (including max retries)
4. Persistent errors have an escalation path (contact support / fallback route)
5. User-facing message keys exist in `copy-structure-spec`
6. Cross-compiler: every error response from `openapi-spec` has a corresponding UX recovery entry
7. 403 / permission errors redirect to an explicit destination (not just "go back")

**Error Codes:**
- `UX120` — Error type has no recovery spec entry
- `UX121` — Recovery action references non-existent route or action
- `UX122` — Network error missing retry behavior definition
- `UX123` — Persistent error has no escalation path
- `UX124` — API error response not covered by UX recovery spec

**Key Invariant:** Compiler must fail if any error type from the API surface has no corresponding UX recovery path defined.

**Safe Default:** Without error-recovery-spec, errors surface as raw error codes or generic messages with no actionable recovery.

**Dependencies:**
- `state-matrix.json`
- `openapi-spec` (already built)
- `copy-structure-spec.json`

**Downstream Consumers:**
- `wireframe-manifest`
- `handoff-annotation-spec`
- `offline-state-spec`

---

### 14. `destructive-action-spec`

**Frequency:** per-feature

**Input:**
- Destructive action list (delete, archive, revoke, reset, overwrite)
- Irreversibility flags per action
- Undo window availability per action
- Scope of impact per action (single item / bulk / cascading)

**Output:**
- `destructive-action-spec.json` — per-action confirmation spec: action ID, destructive tier (`soft` / `hard` / `cascading`), confirmation pattern (`inline-confirm` / `modal` / `typed-confirm`), undo window (seconds or `none`), scope description, rollback behavior

**Spec file:** `destructive-action-spec.spec.json`

**Correctness Gates:**
1. Every destructive action has a `destructive_tier` assigned
2. `hard` tier actions require `typed-confirm` or `modal` confirmation pattern
3. Every action with `undo_window: none` has a warning copy key defined
4. Cascading actions enumerate the downstream impact objects
5. Confirmation copy keys exist in `copy-structure-spec`
6. Bulk destructive actions require a scope description ("X items will be deleted")
7. Undo window is a specific duration (not `"short"` or `"brief"`)

**Error Codes:**
- `UX130` — Destructive action missing tier assignment
- `UX131` — Hard tier action uses inline-confirm pattern (insufficient)
- `UX132` — Cascading action missing impact object list
- `UX133` — Copy key not found in copy-structure-spec
- `UX134` — Undo window is non-specific duration

**Key Invariant:** Compiler must fail if any `hard` or `cascading` action uses `inline-confirm` as its confirmation pattern.

**Safe Default:** Without destructive-action-spec, delete/revoke actions are implemented without confirmation patterns, causing accidental data loss.

**Dependencies:**
- `task-flow.json`
- `copy-structure-spec.json`

**Downstream Consumers:**
- `wireframe-manifest`
- `handoff-annotation-spec`

---

### 15. `search-filter-sort-spec`

**Frequency:** per-feature

**Input:**
- Data model (entity type, fields)
- Filterable field list
- Sort option list
- Search scope (global / section / entity-type)
- Real-time vs submitted search config
- `ia-spec.json` (search surface definitions)

**Output:**
- `search-filter-sort-spec.json` — interaction spec: search input behavior (debounce / instant / submitted), filter panel structure (filter groups, types), sort options (field, direction, default), URL persistence rules, combined state behavior, result count display rules

**Spec file:** `search-filter-sort-spec.spec.json`

**Correctness Gates:**
1. Every filterable field has a defined filter type (`multiselect` / `range` / `date-range` / `boolean` / `text`)
2. Every sort option has a default direction defined
3. Combined filter+sort state is defined (not just each in isolation)
4. URL persistence is declared: `persist: true | false` per filter
5. Empty result state is defined and references `empty-state-spec`
6. Search debounce delay is a specific millisecond value (not "fast" or "slow")
7. Every filter applied state has a clear/reset mechanism defined

**Error Codes:**
- `UX140` — Filterable field missing filter type
- `UX141` — Sort option missing default direction
- `UX142` — URL persistence not declared for filter
- `UX143` — Empty result state not referenced
- `UX144` — Search debounce is non-specific

**Key Invariant:** Compiler must fail if the combined filter+sort+search state has no defined behavior spec.

**Safe Default:** Without search-filter-sort-spec, filter/sort interactions are inconsistent across data surfaces.

**Dependencies:**
- `ia-spec.json`
- `empty-state-spec.json`
- `state-matrix.json`

**Downstream Consumers:**
- `data-table-interaction-spec`
- `wireframe-manifest`
- `handoff-annotation-spec`

---

### 16. `data-table-interaction-spec`

**Frequency:** per-feature

**Input:**
- Table schema (columns, data types)
- Row action list (view, edit, delete, select, expand)
- Pagination config (page size, cursor vs offset)
- Bulk action availability
- Column visibility / customization requirements

**Output:**
- `data-table-spec.json` — table interaction definition: column list with sort/filter flags, row action menu spec, pagination type and behavior, bulk selection pattern, inline editing rules, expand/collapse behavior, loading/empty/error row states

**Spec file:** `data-table-spec.spec.json`

**Correctness Gates:**
1. Every column has a `sortable` and `filterable` flag defined
2. Every row action references a `task-flow` or route ID
3. Bulk actions are enumerated with scope description (N rows selected)
4. Pagination type is one of: `page` | `cursor` | `infinite-scroll` | `load-more`
5. Loading state is defined at row level (skeleton rows)
6. Column visibility customization: saved state persistence behavior is declared
7. Cross-compiler: every row action that triggers a destructive operation references `destructive-action-spec`

**Error Codes:**
- `UX150` — Column missing sortable/filterable flag
- `UX151` — Row action references non-existent task-flow or route
- `UX152` — Pagination type not declared
- `UX153` — Bulk action missing scope description
- `UX154` — Destructive row action not linked to destructive-action-spec

**Key Invariant:** Compiler must fail if any row action that modifies or deletes data has no confirmation or `destructive-action-spec` reference.

**Safe Default:** Without data-table-spec, table interactions (row actions, bulk ops, pagination) are implemented inconsistently.

**Dependencies:**
- `search-filter-sort-spec.json`
- `task-flow.json`
- `destructive-action-spec.json`
- `state-matrix.json`

**Downstream Consumers:**
- `wireframe-manifest`
- `handoff-annotation-spec`

---

### 17. `dashboard-hierarchy-spec`

**Frequency:** per-feature

**Input:**
- Widget/panel list
- Data source per widget
- User role map (which roles see which widgets)
- Priority/importance ranking
- Responsive layout requirements

**Output:**
- `dashboard-hierarchy-spec.json` — dashboard layout and hierarchy: widget list, data source reference, role visibility map, information priority order, grouping structure, drill-down paths, refresh behavior

**Spec file:** `dashboard-hierarchy-spec.spec.json`

**Correctness Gates:**
1. Every widget has a data source reference
2. Every widget has a role visibility rule
3. Information priority order is defined (1 = most important)
4. Every widget has loading, empty, and error states referenced in `state-matrix`
5. Drill-down paths reference valid routes in `sitemap.json`
6. Refresh behavior is defined: `manual` | `polling` (with interval) | `real-time`
7. Widget layout order is defined for each breakpoint if responsive

**Error Codes:**
- `UX160` — Widget missing data source reference
- `UX161` — Widget missing role visibility rule
- `UX162` — Drill-down path references non-existent route
- `UX163` — Widget state not covered in state-matrix
- `UX164` — Refresh behavior undefined

**Key Invariant:** Compiler must fail if any widget's drill-down path references a route that is not present in `sitemap.json`.

**Safe Default:** Without dashboard-hierarchy-spec, widget priority and role visibility are arbitrary, causing information overload or missing data for users.

**Dependencies:**
- `ia-spec.json`
- `state-matrix.json`
- `permission-ux-branch-spec.json`
- `sitemap.json`

**Downstream Consumers:**
- `wireframe-manifest`
- `handoff-annotation-spec`

---

### 18. `wireframe-manifest`

**Frequency:** per-feature

**Input:**
- `user-flow.json`
- `state-matrix.json`
- `form-flow-spec.json` (if applicable)
- `navigation-spec.json`
- All relevant feature-level specs

**Output:**
- `wireframe-manifest.json` — screen inventory with structured annotations: screen ID, associated flow node, states covered, layout region map (header / nav / main / aside / footer), interactive element list with behavior references, annotation links

**Spec file:** `wireframe-manifest.spec.json`

**Correctness Gates:**
1. Every screen in the associated `user-flow` has a wireframe entry
2. Every wireframe entry covers all states defined in `state-matrix` for that screen
3. Every interactive element references a `task-flow` step or route transition
4. Layout regions are defined for each breakpoint
5. Every wireframe screen ID maps to a sitemap node
6. Cross-compiler: every form in the wireframe references a `form-flow-spec` ID
7. Cross-compiler: every nav element in the wireframe is consistent with `navigation-spec`

**Error Codes:**
- `UX170` — Flow screen has no wireframe entry
- `UX171` — Wireframe screen missing state coverage
- `UX172` — Interactive element has no behavior reference
- `UX173` — Wireframe screen ID not in sitemap
- `UX174` — Form in wireframe not linked to form-flow-spec

**Key Invariant:** Compiler must fail if any screen in the user-flow has no corresponding wireframe entry.

**Safe Default:** Without wireframe-manifest, developers have no structured screen inventory and implement layouts from scratch without behavioral references.

**Dependencies:**
- `user-flow.json`
- `state-matrix.json`
- `form-flow-spec.json`
- `navigation-spec.json`
- `empty-state-spec.json`
- `error-recovery-spec.json`

**Downstream Consumers:**
- `handoff-annotation-spec`
- `usability-test-script-spec`
- `react-page` (already built — consumes as reference)
- `react-component` (already built — consumes as reference)

---

### 19. `copy-structure-spec`

**Frequency:** per-feature

**Input:**
- Content inventory (all user-facing strings)
- i18n key namespace conventions
- Interpolation variable list
- Locale list (from localization requirements)
- Tone/voice guidelines (structured, not stylistic)

**Output:**
- `copy-structure-spec.json` — copy key registry: key ID, default text, interpolation variables, character limit, context description, i18n flag, RTL-safe flag

**Spec file:** `copy-structure-spec.spec.json`

**Correctness Gates:**
1. Every user-facing string has a unique key ID
2. Every interpolation variable is declared in the key's variable list
3. Character limits are defined for constrained UI spaces (button labels, nav labels, table headers)
4. Every key flagged `i18n: true` has a corresponding entry in the i18n translation catalog
5. Every key used in `error-recovery-spec`, `empty-state-spec`, or `destructive-action-spec` exists in this registry
6. Cross-compiler: every i18n key references a valid key in the `i18n` shared compiler output
7. RTL-safe flag is set for all keys used in RTL-aware layouts

**Error Codes:**
- `UX180` — User-facing string has no key ID
- `UX181` — Interpolation variable undeclared in key spec
- `UX182` — i18n-flagged key not found in translation catalog
- `UX183` — Key referenced by downstream spec not found in registry
- `UX184` — Character limit missing for constrained UI element

**Key Invariant:** Compiler must fail if any key referenced by a downstream spec (error-recovery, empty-state, destructive-action) does not exist in the registry.

**Safe Default:** Without copy-structure-spec, strings are hardcoded in components, preventing i18n and causing inconsistent error messaging.

**Dependencies:**
- `i18n` (shared compiler — cross-check)
- `empty-state-spec.json`
- `error-recovery-spec.json`

**Downstream Consumers:**
- `form-flow-spec`
- `destructive-action-spec`
- `empty-state-spec`
- `error-recovery-spec`
- `handoff-annotation-spec`
- `localization-flow-constraint-spec`

---

### 20. `responsive-structure-spec`

**Frequency:** per-feature

**Input:**
- Breakpoint definitions (mobile / tablet / desktop / wide)
- Layout region list
- Component reflow rules (collapse / stack / hide / tab / paginate)
- Touch target requirements
- Navigation pattern changes per breakpoint

**Output:**
- `responsive-structure-spec.json` — per-breakpoint layout rules: layout regions, reflow behavior per region, component-level visibility rules, navigation pattern overrides, minimum touch target sizes

**Spec file:** `responsive-structure-spec.spec.json`

**Correctness Gates:**
1. Every defined breakpoint has a complete layout region spec
2. Every component with a `collapse` rule defines what triggers and what replaces it
3. Touch targets are defined with explicit minimum pixel dimensions (not just "large enough")
4. Navigation pattern changes are explicit (hamburger menu, bottom nav, etc.)
5. Hidden components at narrow breakpoints are not critical-path user actions
6. Reflow rules do not create horizontal overflow (verified by structural logic)

**Error Codes:**
- `UX190` — Breakpoint missing layout region spec
- `UX191` — Collapsed component has no replacement behavior
- `UX192` — Touch target missing pixel dimension
- `UX193` — Navigation pattern change missing explicit spec
- `UX194` — Critical action hidden at narrow breakpoint

**Key Invariant:** Compiler must fail if any critical-path user action is hidden or inaccessible at any defined breakpoint.

**Safe Default:** Without responsive-structure-spec, mobile layouts are ad-hoc and may hide critical actions or produce broken reflows.

**Dependencies:**
- `wireframe-manifest.json`
- `navigation-spec.json`

**Downstream Consumers:**
- `rtl-structure-spec`
- `handoff-annotation-spec`

---

### 21. `rtl-structure-spec`

**Frequency:** per-project

**Input:**
- Layout spec (`wireframe-manifest.json`)
- `responsive-structure-spec.json`
- RTL locale list
- Component list with directional dependencies
- Icon/illustration directional flip requirements

**Output:**
- `rtl-spec.json` — per-component RTL rule set: flip rule (`mirror` / `no-mirror`), text alignment override, icon flip flag, layout direction override, bidirectional text handling rule

**Spec file:** `rtl-spec.spec.json`

**Correctness Gates:**
1. Every component in the wireframe manifest has an RTL flip rule
2. No component has `flip: mirror` and `text-align: left` simultaneously
3. Icons with directional meaning (arrows, chevrons, back buttons) have explicit flip flags
4. Bidirectional text fields (mixed LTR/RTL) have a `bidi_handling` rule
5. Progress indicators and step flows have direction override defined
6. Numeric and date fields have `no-mirror` declared (numbers do not flip)

**Error Codes:**
- `UX200` — Component missing RTL flip rule
- `UX201` — Mirror + left-align conflict detected
- `UX202` — Directional icon missing flip flag
- `UX203` — Bidirectional text field missing bidi_handling rule
- `UX204` — Numeric field missing no-mirror declaration

**Key Invariant:** Compiler must fail if any directional icon (arrow, chevron, progress indicator) has no explicit flip rule.

**Safe Default:** Without RTL spec, RTL locales render mirrored layouts incorrectly, with wrong-direction arrows and misaligned text.

**Dependencies:**
- `wireframe-manifest.json`
- `responsive-structure-spec.json`
- `localization-flow-constraint-spec.json`

**Downstream Consumers:**
- `handoff-annotation-spec`
- `localization-flow-constraint-spec`

---

### 22. `localization-flow-constraint-spec`

**Frequency:** per-project

**Input:**
- Locale list
- String expansion factors per locale (e.g., German +30%, Arabic +15%)
- Layout constraints (fixed-width containers, truncation rules)
- Date/number/currency format requirements per locale
- Locale-specific flow differences (e.g., different consent screens for GDPR regions)

**Output:**
- `l10n-flow-spec.json` — per-locale flow constraints: string expansion budget per layout zone, truncation fallback rules, locale-specific screen overrides, date/number format spec, RTL locale list

**Spec file:** `l10n-flow-spec.spec.json`

**Correctness Gates:**
1. Every locale has a string expansion factor defined
2. Every fixed-width UI zone has a maximum character budget per locale
3. Truncation fallback is defined for every constrained zone (`ellipsis` / `line-wrap` / `resize`)
4. Locale-specific screen overrides reference valid sitemap nodes
5. Date/number/currency format is defined for every locale
6. RTL locales are enumerated and linked to `rtl-spec.json`
7. Cross-compiler: every i18n key with a character limit in `copy-structure-spec` is validated against the expansion budget for each locale

**Error Codes:**
- `UX210` — Locale missing string expansion factor
- `UX211` — Fixed-width zone missing character budget for locale
- `UX212` — Truncation fallback not defined for constrained zone
- `UX213` — Locale screen override references non-existent sitemap node
- `UX214` — i18n key exceeds character budget for locale

**Key Invariant:** Compiler must fail if any locale's string expansion factor causes a fixed-width UI zone to exceed its character budget with no fallback defined.

**Safe Default:** Without l10n-flow-spec, localized strings overflow fixed containers and locale-specific flows are absent.

**Dependencies:**
- `copy-structure-spec.json`
- `rtl-structure-spec.json`
- `sitemap.json`
- `i18n` (shared compiler)

**Downstream Consumers:**
- `handoff-annotation-spec`

---

### 23. `experiment-variant-flow-spec`

**Frequency:** per-experiment

**Input:**
- Feature flag config (`feature-flag` shared compiler output)
- Variant definitions (control + treatment(s))
- Goal event definitions (`analytics-event` shared compiler output)
- Holdout / exclusion rules
- Conflicting experiment rules

**Output:**
- `experiment-variant-spec.json` — per-variant flow definition: variant ID, flag key, flow diffs vs control (screens added/removed/changed), goal events mapped, exclusion rules, conflict matrix

**Spec file:** `experiment-variant-spec.spec.json`

**Correctness Gates:**
1. Every variant has a unique `variant_id`
2. Control variant is explicitly defined (not implied by absence)
3. Every flow diff references a specific screen or node change (not vague "different UI")
4. Goal events reference valid entries in `analytics-event` catalog
5. Cross-compiler: every `flag_key` in spec exists in the `feature-flag` compiler output
6. No two active experiments modify the same flow node without a conflict rule
7. Holdout percentage sums are validated (control + treatments = 100%)
8. Every variant flow terminates in the same terminal node types as the control

**Error Codes:**
- `UX220` — Control variant not explicitly defined
- `UX221` — Flow diff is vague (not referencing specific node)
- `UX222` — Goal event not found in analytics-event catalog
- `UX223` — Flag key not found in feature-flag output
- `UX224` — Variant allocation does not sum to 100%

**Key Invariant:** Compiler must fail if any treatment variant's flow has a different set of terminal node types than the control variant.

**Safe Default:** Without experiment-variant-flow-spec, A/B test variants are implemented without validated flow coverage, risking broken paths in treatment groups.

**Dependencies:**
- `user-flow.json`
- `feature-flag` (shared compiler)
- `analytics-event` (shared compiler)

**Downstream Consumers:**
- `wireframe-manifest`
- `usability-test-script-spec`

---

### 24. `journey-map-spec`

**Frequency:** per-project

**Input:**
- User research data (structured: persona, phase, touchpoint, emotion score)
- Touchpoint inventory
- Channel list (web, mobile, email, support, etc.)
- Pain point taxonomy

**Output:**
- `journey-map-spec.json` — formalized journey: persona ID, phases, per-phase touchpoints, per-touchpoint channel, emotion score (1–5), pain point IDs, opportunity flags

**Spec file:** `journey-map-spec.spec.json`

**Correctness Gates:**
1. Every phase has at least one touchpoint
2. Every touchpoint has a channel assigned
3. Emotion scores are numeric (1–5), not qualitative labels
4. Every pain point has a unique ID and a severity (high / medium / low)
5. Opportunity flags reference a specific flow or feature compiler (not vague "improve UX")
6. Every digital touchpoint references a sitemap node or external channel

**Error Codes:**
- `UX230` — Phase has no touchpoints
- `UX231` — Touchpoint missing channel assignment
- `UX232` — Emotion score is non-numeric
- `UX233` — Pain point missing severity
- `UX234` — Opportunity flag has no compiler reference

**Key Invariant:** Compiler must fail if any opportunity flag does not reference a specific compiler ID or planned feature.

**Safe Default:** Without journey-map-spec, product decisions lack structured user context; pain points remain undocumented.

**Dependencies:**
- `sitemap.json`
- User research input (external)

**Downstream Consumers:**
- `onboarding-flow-spec`
- `returning-user-flow-spec`
- `abuse-surface-model` (security compiler — for user-driven abuse patterns)

---

### 25. `route-guard-spec`

**Frequency:** per-feature

**Input:**
- Route list from `sitemap.json`
- Auth states (unauthenticated / authenticated / role-specific)
- Redirect rules per auth state
- `route-not-found` (404) behavior
- First-run / onboarding gate requirements

**Output:**
- `route-guard-spec.json` — per-route access rules: required auth state, required role, redirect destination on failure, 404 behavior, first-run gate flag, deep-link preservation behavior

**Spec file:** `route-guard-spec.spec.json`

**Correctness Gates:**
1. Every route in `sitemap.json` has a guard rule entry
2. Every authenticated route has a `redirect_on_unauth` destination defined
3. `redirect_on_unauth` destinations are valid routes in `sitemap.json`
4. 404/not-found behavior is defined globally and for role-specific not-found states
5. First-run gates specify which routes trigger onboarding redirect
6. Deep-link preservation behavior is declared for every auth-gated route
7. Cross-compiler: guard rules must not contradict `authz-policy` (no route accessible by a role denied at the API level)

**Error Codes:**
- `UX240` — Route missing guard rule entry
- `UX241` — Authenticated route missing redirect_on_unauth
- `UX242` — Redirect destination not in sitemap
- `UX243` — 404 behavior not defined
- `UX244` — Guard rule contradicts authz-policy access control

**Key Invariant:** Compiler must fail if any authenticated route has no `redirect_on_unauth` destination defined.

**Safe Default:** Without route-guard-spec, unauthenticated users reach protected screens or receive blank 403 pages with no redirect.

**Dependencies:**
- `sitemap.json`
- `authz-policy` (security compiler)
- `permission-ux-branch-spec.json`

**Downstream Consumers:**
- `navigation-spec`
- `user-flow`
- `onboarding-flow-spec`
- `returning-user-flow-spec`

---

### 26. `abandoned-flow-recovery-spec`

**Frequency:** per-feature

**Input:**
- `multi-step-flow-spec.json`
- Session persistence model
- Re-entry trigger config (email, notification, direct URL)
- Draft save behavior requirements
- Expiry rules

**Output:**
- `abandoned-flow-spec.json` — per-flow abandonment handling: draft persistence behavior, re-entry point, restore vs restart decision logic, expiry period, notification trigger rules, completion nudge config

**Spec file:** `abandoned-flow-spec.spec.json`

**Correctness Gates:**
1. Every multi-step flow with ≥ 2 steps has an abandonment entry
2. Draft persistence behavior is explicitly declared (`save-draft` | `discard` | `prompt`)
3. Re-entry point is a valid route in `sitemap.json`
4. Expiry period is a specific duration (not "eventually")
5. Restore vs restart logic is binary (condition-based, not qualitative)
6. Notification triggers reference valid event types in `analytics-event` catalog

**Error Codes:**
- `UX250` — Multi-step flow missing abandonment entry
- `UX251` — Draft persistence behavior not declared
- `UX252` — Re-entry route not in sitemap
- `UX253` — Expiry period is non-specific
- `UX254` — Restore/restart logic is non-binary

**Key Invariant:** Compiler must fail if any multi-step flow with ≥ 2 steps has no abandonment behavior defined.

**Safe Default:** Without abandoned-flow-recovery-spec, partially completed flows are lost silently, causing user frustration and drop-off.

**Dependencies:**
- `multi-step-flow-spec.json`
- `sitemap.json`
- `analytics-event` (shared compiler)

**Downstream Consumers:**
- `wireframe-manifest`
- `handoff-annotation-spec`

---

### 27. `offline-state-spec`

**Frequency:** per-feature

**Input:**
- Network-dependent action list
- Cache strategy per resource type
- Sync behavior on reconnection
- `error-recovery-spec.json` (offline entries)
- `state-matrix.json` (offline state entries)

**Output:**
- `offline-state-spec.json` — per-surface offline behavior: detection method, offline indicator placement, degraded functionality rules, read-only mode config, queued-action behavior, sync-on-reconnect rules, conflict resolution strategy

**Spec file:** `offline-state-spec.spec.json`

**Correctness Gates:**
1. Every network-dependent action has an offline behavior defined (`block` | `queue` | `degrade`)
2. Offline detection method is specified (service worker / navigator.onLine / server heartbeat)
3. Queued actions have a queue limit defined
4. Sync-on-reconnect behavior handles conflicts explicitly (`last-write-wins` | `server-wins` | `prompt-user`)
5. Offline indicator placement is defined (not just "show something")
6. Read-only mode defines which features remain accessible offline

**Error Codes:**
- `UX260` — Network-dependent action missing offline behavior
- `UX261` — Offline detection method not specified
- `UX262` — Queued action missing queue limit
- `UX263` — Sync conflict resolution not defined
- `UX264` — Offline indicator placement not specified

**Key Invariant:** Compiler must fail if any data-mutating action has no offline behavior defined (cannot be silently allowed offline).

**Safe Default:** Without offline-state-spec, apps silently fail on network loss or show broken partial states.

**Dependencies:**
- `state-matrix.json`
- `error-recovery-spec.json`

**Downstream Consumers:**
- `wireframe-manifest`
- `handoff-annotation-spec`

---

### 28. `handoff-annotation-spec`

**Frequency:** per-feature

**Input:**
- `wireframe-manifest.json`
- All feature-level specs (flow, state, form, etc.)
- Component behavior notes
- Animation/transition behavior that affects flow logic

**Output:**
- `handoff-annotation-spec.json` — structured developer handoff: per-screen annotation list with behavior references, interaction notes (hover / focus / press / drag), transition behavior (enter/exit), edge case callouts, cross-spec reference links

**Spec file:** `handoff-annotation-spec.spec.json`

**Correctness Gates:**
1. Every interactive element in `wireframe-manifest` has at least one annotation
2. Every annotation references a source spec (flow, state-matrix, form-flow, etc.)
3. Transition behavior that affects flow logic is annotated (not just visual transitions)
4. Every edge case from `state-matrix` is annotated on the relevant screen
5. Annotation format is structured (not free-text) — each has: element_id, type, behavior description, spec_reference
6. Cross-compiler: every `react-component` interactive pattern referenced in annotations exists in the component library

**Error Codes:**
- `UX270` — Interactive element missing annotation
- `UX271` — Annotation has no spec reference
- `UX272` — Edge case from state-matrix not annotated
- `UX273` — Annotation is unstructured free-text
- `UX274` — Referenced react-component pattern not found in library

**Key Invariant:** Compiler must fail if any interactive element in the wireframe has no corresponding annotation.

**Safe Default:** Without handoff-annotation-spec, developers implement behavior from visual inspection alone, missing edge cases and interaction nuances.

**Dependencies:**
- `wireframe-manifest.json`
- `state-matrix.json`
- `form-flow-spec.json`
- `error-recovery-spec.json`
- `destructive-action-spec.json`
- `responsive-structure-spec.json`

**Downstream Consumers:**
- `react-component` (already built — consumes as reference)
- `react-page` (already built — consumes as reference)

---

### 29. `usability-test-script-spec`

**Frequency:** per-experiment

**Input:**
- `user-flow.json`
- `task-flow.json`
- Research hypothesis
- Participant profile requirements
- Success metric definitions (completion rate, time-on-task, error count)

**Output:**
- `usability-test-spec.json` — structured test script: study ID, hypothesis, participant criteria, task list (task ID, instruction, entry point, success condition, observation targets), metrics (binary checkable), debrief questions

**Spec file:** `usability-test-spec.spec.json`

**Correctness Gates:**
1. Every task has an explicit `success_condition` (binary pass/fail)
2. Every task references a `user-flow` or `task-flow` ID it is testing
3. Participant criteria are specific (not vague demographics)
4. Metrics are quantitative or binary (not "user felt confident")
5. Entry point for every task is a valid route in `sitemap.json`
6. Observation targets reference specific interactive elements (not "watch what they do")

**Error Codes:**
- `UX280` — Task missing binary success condition
- `UX281` — Task not linked to user-flow or task-flow ID
- `UX282` — Metric is non-quantitative
- `UX283` — Entry point not in sitemap
- `UX284` — Observation target is non-specific

**Key Invariant:** Compiler must fail if any task's `success_condition` is not a binary, evaluable expression.

**Safe Default:** Without usability-test-spec, user research produces unstructured observations that cannot feed back into formal spec updates.

**Dependencies:**
- `user-flow.json`
- `task-flow.json`
- `wireframe-manifest.json`
- `sitemap.json`

**Downstream Consumers:**
- UX research synthesis pipeline
- `journey-map-spec` (feedback loop)

---

### 30. `ux-audit-report`

**Frequency:** daily

**Input:**
- All `*-spec.json` and `*-flow.json` artifacts (current state)
- Route registry from `sitemap.json`
- `state-matrix.json` (coverage check)
- `openapi-spec` (API surface completeness check)

**Output:**
- `ux-audit-report.json` — coverage audit: spec coverage percentage, unspecified screens, uncovered states, missing annotations, cross-compiler mismatches, stale spec flags (spec references a deleted route)

**Spec file:** `ux-audit-report.spec.json`

**Correctness Gates:**
1. Report covers 100% of routes in `sitemap.json`
2. Every route with a data dependency has a `state-matrix` entry
3. Every screen in sitemap has a `wireframe-manifest` entry or is flagged `planned`
4. Stale references are flagged: spec entries referencing deleted or renamed routes
5. Cross-compiler mismatch count is reported per mismatch type
6. Report includes a `coverage_score` field (percentage of screens fully specified)
7. Report timestamp and source artifact SHAs are present

**Error Codes:**
- `UX290` — Route not covered by any spec
- `UX291` — Data-dependent route missing state-matrix entry
- `UX292` — Screen in sitemap missing wireframe entry (and not flagged planned)
- `UX293` — Stale spec reference detected (route no longer exists)
- `UX294` — Cross-compiler mismatch detected

**Key Invariant:** Compiler must fail if any route in `sitemap.json` has zero spec coverage and is not flagged `planned`.

**Safe Default:** Without ux-audit-report, spec drift accumulates silently — outdated flows reference deleted routes and missing states go unnoticed.

**Dependencies:**
- All `*-spec.json` artifacts (full compiler network output)
- `sitemap.json`
- `openapi-spec` (already built)

**Downstream Consumers:**
- Design team sprint planning
- Cross-role compiler mismatch alerts

---

## Recommended Build Order

The dependency graph resolves into five tiers. Structural and taxonomic compilers must precede flow compilers, which must precede interaction and handoff compilers.

---

### Tier 0 — Structural Foundations (no UX compiler dependencies)

These must exist before any flow or interaction compiler can validate correctly.

```
1. sitemap                        ← foundational route/screen map
2. pii-classification-policy      ← (security, but foundational for copy/data)
3. authz-policy                   ← (security, foundational for permission branching)
```

---

### Tier 1 — Taxonomy & Architecture (depend only on Tier 0)

```
4. information-architecture       ← depends on: sitemap
5. permission-ux-branch-spec      ← depends on: sitemap, authz-policy
6. route-guard-spec               ← depends on: sitemap, authz-policy
7. copy-structure-spec            ← depends on: i18n (shared), can start early
```

---

### Tier 2 — Core Flow Compilers (depend on Tier 0–1)

```
8.  user-flow                     ← depends on: sitemap, permission-ux-branch-spec, route-guard-spec
9.  navigation-spec               ← depends on: sitemap, ia-spec, permission-ux-branch-spec, route-guard-spec
10. task-flow                     ← depends on: user-flow, openapi-spec
11. journey-map-spec              ← depends on: sitemap
```

---

### Tier 3 — State, Form & Interaction Compilers (depend on Tier 2)

```
12. state-matrix                  ← depends on: user-flow, task-flow, openapi-spec
13. form-flow-spec                ← depends on: task-flow, copy-structure-spec
14. destructive-action-spec       ← depends on: task-flow, copy-structure-spec
15. empty-state-spec              ← depends on: state-matrix, copy-structure-spec
16. error-recovery-spec           ← depends on: state-matrix, openapi-spec, copy-structure-spec
17. search-filter-sort-spec       ← depends on: ia-spec, empty-state-spec
18. abandoned-flow-recovery-spec  ← depends on: multi-step-flow-spec (soft), sitemap
```

---

### Tier 4 — Composite & Specialist Compilers (depend on Tier 3)

```
19. multi-step-flow-spec          ← depends on: form-flow-spec, task-flow
20. data-table-interaction-spec   ← depends on: search-filter-sort-spec, task-flow, destructive-action-spec
21. dashboard-hierarchy-spec      ← depends on: ia-spec, state-matrix, permission-ux-branch-spec
22. offline-state-spec            ← depends on: state-matrix, error-recovery-spec
23. responsive-structure-spec     ← depends on: wireframe-manifest (soft), navigation-spec
```

---

### Tier 5 — Structural Completeness Compilers (depend on Tier 4)

```
24. onboarding-flow-spec          ← depends on: sitemap, navigation-spec, multi-step-flow-spec, route-guard-spec
25. returning-user-flow-spec      ← depends on: onboarding-flow-spec, sitemap, route-guard-spec
26. experiment-variant-flow-spec  ← depends on: user-flow, feature-flag (shared), analytics-event (shared)
27. localization-flow-constraint-spec ← depends on: copy-structure-spec, rtl-structure-spec
```

---

### Tier 6 — Wireframe & Handoff (depend on most prior compilers)

```
28. wireframe-manifest            ← depends on: user-flow, state-matrix, form-flow-spec, navigation-spec,
                                               empty-state-spec, error-recovery-spec
29. rtl-structure-spec            ← depends on: wireframe-manifest, responsive-structure-spec
30. handoff-annotation-spec       ← depends on: wireframe-manifest + all feature-level specs
```

---

### Tier 7 — Validation & Research Compilers (depend on full compiler network)

```
31. usability-test-script-spec    ← depends on: user-flow, task-flow, wireframe-manifest
32. ux-audit-report               ← depends on: ALL spec outputs + sitemap + openapi-spec
```

---

### Full Linear Build Order (safe DAG serialization)

```
1.  sitemap
2.  information-architecture
3.  route-guard-spec
4.  permission-ux-branch-spec
5.  copy-structure-spec
6.  user-flow
7.  navigation-spec
8.  task-flow
9.  journey-map-spec
10. state-matrix
11. form-flow-spec
12. destructive-action-spec
13. empty-state-spec
14. error-recovery-spec
15. search-filter-sort-spec
16. multi-step-flow-spec
17. abandoned-flow-recovery-spec
18. data-table-interaction-spec
19. dashboard-hierarchy-spec
20. offline-state-spec
21. onboarding-flow-spec
22. returning-user-flow-spec
23. experiment-variant-flow-spec
24. wireframe-manifest
25. responsive-structure-spec
26. rtl-structure-spec
27. localization-flow-constraint-spec
28. handoff-annotation-spec
29. usability-test-script-spec
30. ux-audit-report
```

---

*Document generated for: Domain Compiler Network — UX Designer Role*
*Total compilers defined: 30*
*Excludes: already-built compilers (9) and shared/cross-role compilers (5)*
*Cross-compiler checks defined against: react-form, react-page, react-component, ts-schema, api-route, openapi-spec, auth-middleware, feature-flag, analytics-event, i18n, authz-policy*
