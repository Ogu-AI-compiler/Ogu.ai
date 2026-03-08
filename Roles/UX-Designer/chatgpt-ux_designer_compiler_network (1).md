# UX Designer Compiler Network

This document decomposes the UX designer role into atomic compiler-sized task types for a formal Domain Compiler Network.

The focus is on machine-checkable UX artifacts only: behavior, structure, flow, state coverage, and verification. Visual styling systems, implementation details, and subjective critique are intentionally excluded.

## Assumptions for cross-compiler validation

To keep the catalog concrete, the cross-compiler checks below assume the existing compiler network exposes machine-readable manifests:

- `react-page` exposes a route and page manifest
- `react-form` exposes a form manifest
- `api-route` and `openapi-spec` expose endpoint, mutation, and error-contract manifests
- `auth-middleware` exposes a route/action guard manifest
- `feature-flag` exposes a flag manifest
- `i18n` exposes locale, interpolation, and key manifests

If your actual filenames differ, keep the contracts and rename the artifacts.

## Summary table

| Task Name (Compiler ID) | Frequency | Input | Output |
|---|---|---|---|
| Wireframe Manifest (`ux-wireframe-manifest`) | daily | Approved screen IDs, user/task flows, state matrix, navigation graph, content modules | Low fidelity screen structures with behavior annotations |
| Copy Structure Spec (`ux-copy-structure`) | daily | Flows, state matrix, wireframes, domain entities, content rules, i18n conventions | Structured content slots, message hierarchy, placeholder contracts, and state messages |
| State Coverage Matrix (`ux-state-matrix`) | daily | Screen map, data dependencies, API error contracts, page manifests, user flows | Per-screen coverage matrix for loading, empty, partial, error, offline, success, unauthorized, and not-found states |
| UX Route-State Parity Report (`ux-parity-report`) | daily | All UX specs, route manifests, form manifests, auth guards, API contracts, feature flags | A machine-readable pass/fail report showing mismatches between intended UX and actual route/state graph |
| User Flow Spec (`ux-user-flow`) | per-feature | Feature brief, screen map, navigation graph, user roles, business rules | End-to-end screen-level flow graph with success, failure, and abandonment terminals |
| Task Flow Spec (`ux-task-flow`) | per-feature | User flow, screen inventory, primary job-to-be-done, actor definition | Goal-specific action sequence with preconditions, system responses, and completion criteria |
| Form Flow Spec (`ux-form-flow`) | per-feature | Form intent, screen map, user flow, form schema, endpoint contract, validation rules | Form behavior spec covering fields, validation, submission, save, and error handling |
| Multi-Step Flow Spec (`ux-multistep-flow`) | per-feature | Form flow, user flow, step definitions, persistence requirements, resume rules | Wizard or stepped-flow graph with progress, navigation, save, resume, and abandonment rules |
| Permission Branching Spec (`ux-permission-branching`) | per-feature | Roles, route inventory, guard policies, business permissions, protected actions | Structured branch matrix for role-based, auth-based, and state-based access behavior |
| Fallback and Recovery Flow Spec (`ux-recovery-flow`) | per-feature | State matrix, user flow, form flow, endpoint failure modes, offline policy | Structured recovery paths for errors, retries, abandoned flows, offline use, and support exits |
| Destructive Action Spec (`ux-destructive-action`) | per-feature | Task flows, permission rules, data model, risk classification, state matrix | Confirmation, undo, irreversible action, and post-action outcome model |
| Onboarding Flow Spec (`ux-onboarding-flow`) | per-feature | Journey map, user flow, account states, permission prompts, setup requirements | First-time user path with orientation, setup, skip, resume, and completion rules |
| Returning User Flow Spec (`ux-returning-user-flow`) | per-feature | Journey map, onboarding status, user history, unfinished work markers, personalization rules | Re-entry rules for previously seen users, including resume, personalization, and stale-state handling |
| Search, Filter, and Sort Spec (`ux-search-filter-sort`) | per-feature | Entity model, IA, listing screens, query capabilities, business defaults | Machine-readable interaction model for search inputs, filters, sorting, persistence, and zero-results behavior |
| Data Table Interaction Model (`ux-data-table-model`) | per-feature | Search spec, permissions, state matrix, data schema, row actions | Structured spec for columns, row actions, bulk actions, selection, pagination, and table states |
| Dashboard Information Hierarchy Spec (`ux-dashboard-hierarchy`) | per-feature | Returning-user rules, IA priorities, metrics inventory, module definitions, state matrix | Priority model for dashboard modules, summaries, drill-downs, and conditional visibility |
| Localization and RTL Constraint Spec (`ux-locale-layout-constraints`) | per-feature | Copy structure, wireframes, locale list, route labels, icon set directionality rules | Locale-aware structural constraints for text expansion, truncation, mirroring, and locale-specific branches |
| Responsive Structure Spec (`ux-responsive-structure`) | per-feature | Wireframes, navigation graph, locale constraints, state matrix, breakpoint policy | Breakpoint-aware structural behavior for layout, navigation mode, region order, and hidden-to-disclosed controls |
| Information Architecture Schema (`ux-information-architecture`) | per-project | Product brief, domain entities, content model, business capabilities, existing routes if any | Structured model of information objects, hierarchies, taxonomies, and retrieval paths |
| Screen Map Spec (`ux-screen-map`) | per-project | IA schema, product scope, route inventory, feature list, actor list | Canonical inventory of screens, routes, route patterns, and screen families |
| Structured Journey Map (`ux-journey-map`) | per-project | Actors, goals, major scenarios, channels, constraints, screen map | Stage-based multi-role journey artifact linking goals, touchpoints, and outcomes |
| Navigation Logic Graph (`ux-navigation-graph`) | per-project | IA schema, screen map, app shell model, entry points, global nav requirements | Typed navigation graph covering menus, deep links, back behavior, and shell transitions |
| Experiment Variant Flow Spec (`ux-experiment-variant-flow`) | per-experiment | Base flow, hypothesis, experiment scope, feature flags, success metric IDs | Control and treatment flow variants with exposure, branching, and rollback rules |
| Usability Evidence Report (`ux-usability-evidence`) | per-experiment | Task flows, wireframes or implemented routes, test sessions, coded observations, issue taxonomy | Machine-checkable evidence report linking observed issues to exact tasks, screens, and severities |

## Detailed breakdown

### 1. Wireframe Manifest (`ux-wireframe-manifest`)

- **Name:** Wireframe Manifest
- **Frequency:** daily
- **Input:** Approved screen IDs, user/task flows, state matrix, navigation graph, content modules
- **Output:** Low fidelity screen structures with behavior annotations
- **Spec file:** `ux/wireframes/<feature>.wireframes.json`
  - Top-level keys: `feature_id, screens, regions, interactions, state_refs, breakpoints, annotations`
- **Correctness gates:**
  - Every wireframe screen references an existing screen-map node and, where implemented, an existing react-page route.
  - Every interactive element references a valid transition, route, mutation, or state change defined elsewhere.
  - Every required state in the state matrix has either its own frame or an explicit inheritance rule.
  - Region IDs are unique within a screen and have deterministic order values.
  - No visual-only styling tokens appear outside allowed structural fields.
- **Dependencies:** `ux-screen-map`, `ux-navigation-graph`, `ux-user-flow`, `ux-state-matrix`
- **Downstream consumers:** `react-page`, `react-component`, `ux-copy-structure`, `ux-responsive-structure`, `ux-parity-report`
- **Error codes:**
  - `UX101 Unknown screen reference`
  - `UX102 Unattached interactive element`
  - `UX103 Required state frame missing`
- **Key invariant:** Fail if any wireframe cannot be resolved to a known screen and transition model.
- **Safe default:** Generate a skeletal one-column layout with primary action, back action, and placeholder regions only.

### 2. Copy Structure Spec (`ux-copy-structure`)

- **Name:** Copy Structure Spec
- **Frequency:** daily
- **Input:** Flows, state matrix, wireframes, domain entities, content rules, i18n conventions
- **Output:** Structured content slots, message hierarchy, placeholder contracts, and state messages
- **Spec file:** `ux/copy/<feature>.copy-structure.json`
  - Top-level keys: `feature_id, content_slots, message_hierarchy, placeholders, state_messages, constraints, variant_refs`
- **Correctness gates:**
  - Every text slot has a unique content ID, target screen or state, and priority level.
  - Every placeholder is typed, named, and compatible with i18n interpolation rules.
  - Every error, empty, loading, offline, and success state has an explicit content mapping or declared inheritance rule.
  - No experimental copy appears without a variant reference.
  - Character limit budgets exist for all primary labels and critical messages.
- **Dependencies:** `ux-user-flow`, `ux-state-matrix`, `ux-wireframe-manifest`, `ux-locale-layout-constraints`
- **Downstream consumers:** `i18n`, `react-page`, `ux-usability-evidence`, `ux-parity-report`
- **Error codes:**
  - `UX104 Duplicate content ID`
  - `UX105 Untyped interpolation placeholder`
  - `UX106 Missing message contract for state`
- **Key invariant:** Fail if any user-visible state can render without a defined content contract.
- **Safe default:** Use neutral autogenerated labels from node names and generic system messages for uncovered states.

### 3. State Coverage Matrix (`ux-state-matrix`)

- **Name:** State Coverage Matrix
- **Frequency:** daily
- **Input:** Screen map, data dependencies, API error contracts, page manifests, user flows
- **Output:** Per-screen coverage matrix for loading, empty, partial, error, offline, success, unauthorized, and not-found states
- **Spec file:** `ux/states/<feature>.state-matrix.json`
  - Top-level keys: `feature_id, screens, data_dependencies, states, render_strategies, allowed_actions, inheritance_rules`
- **Correctness gates:**
  - Every data-dependent screen declares all required state classes: loading, success, empty, error, and any applicable offline, partial, unauthorized, and not-found states.
  - Every state references a valid page, query, endpoint, or mutation from react-page, api-route, or openapi manifests.
  - Every non-terminal error state declares at least one allowed recovery or escape action.
  - Partial and offline states declare stale-data behavior and freshness labeling policy.
  - No screen contains duplicate state IDs for the same data dependency.
- **Dependencies:** `ux-screen-map`, `ux-user-flow`, `react-page`, `api-route`, `openapi-spec`
- **Downstream consumers:** `ux-wireframe-manifest`, `ux-copy-structure`, `ux-recovery-flow`, `ux-parity-report`
- **Error codes:**
  - `UX107 Missing required state class`
  - `UX108 Unknown data dependency`
  - `UX109 Recovery action not defined`
- **Key invariant:** Fail if any data-dependent surface lacks explicit coverage for all required runtime states.
- **Safe default:** Use blocking loading, generic error, generic empty, and read-only stale offline fallback states.

### 4. UX Route-State Parity Report (`ux-parity-report`)

- **Name:** UX Route-State Parity Report
- **Frequency:** daily
- **Input:** All UX specs, route manifests, form manifests, auth guards, API contracts, feature flags
- **Output:** A machine-readable pass/fail report showing mismatches between intended UX and actual route/state graph
- **Spec file:** `ux/reports/<feature>.ux-parity-report.json`
  - Top-level keys: `feature_id, checked_artifacts, coverage, mismatches, severity, blocking_failures, recommendations`
- **Correctness gates:**
  - Every current route from react-page is checked against at least one UX artifact or explicitly marked out-of-scope.
  - Every implemented form from react-form is checked against a form-flow spec.
  - Every auth-protected route is checked against permission-branching rules.
  - Every surfaced API error code mapped to the frontend is checked against the state matrix or recovery flow.
  - Every mismatch is classified with severity and owner artifact.
- **Dependencies:** `ux-screen-map`, `ux-navigation-graph`, `ux-user-flow`, `ux-form-flow`, `ux-state-matrix`, `ux-permission-branching`, `react-page`, `react-form`, `auth-middleware`, `api-route`, `openapi-spec`
- **Downstream consumers:** `release-gating`, `react-page`, `react-form`, `auth-middleware`, `ux-wireframe-manifest`
- **Error codes:**
  - `UX110 Unchecked route detected`
  - `UX111 Implemented state missing UX coverage`
  - `UX112 Severity classification missing`
- **Key invariant:** Fail if any implemented route, state, or guarded branch exists without an owning UX specification.
- **Safe default:** Block new unmatched routes and flag legacy unmatched routes for manual override only.

### 5. User Flow Spec (`ux-user-flow`)

- **Name:** User Flow Spec
- **Frequency:** per-feature
- **Input:** Feature brief, screen map, navigation graph, user roles, business rules
- **Output:** End-to-end screen-level flow graph with success, failure, and abandonment terminals
- **Spec file:** `ux/flows/<feature>.user-flow.json`
  - Top-level keys: `feature_id, actors, entry_points, nodes, edges, terminals, branch_conditions, metrics`
- **Correctness gates:**
  - Every flow has at least one entry point and at least one terminal outcome.
  - Every node references a valid screen or explicit non-screen system state.
  - Every branch condition is explicit and typed as permission, data state, experiment, or user choice.
  - Every path terminates in success, failure, cancellation, or handoff; dangling paths are forbidden.
  - If a corresponding route already exists, every screen node maps to a known react-page route.
- **Dependencies:** `ux-screen-map`, `ux-navigation-graph`
- **Downstream consumers:** `ux-task-flow`, `ux-form-flow`, `ux-state-matrix`, `ux-wireframe-manifest`, `ux-onboarding-flow`, `ux-returning-user-flow`, `ux-parity-report`
- **Error codes:**
  - `UX113 Dangling path`
  - `UX114 Unknown screen node`
  - `UX115 Terminal outcome missing`
- **Key invariant:** Fail if any reachable path does not end in a defined terminal state.
- **Safe default:** Use a shortest-path happy flow with a generic cancellation terminal until a fuller flow is authored.

### 6. Task Flow Spec (`ux-task-flow`)

- **Name:** Task Flow Spec
- **Frequency:** per-feature
- **Input:** User flow, screen inventory, primary job-to-be-done, actor definition
- **Output:** Goal-specific action sequence with preconditions, system responses, and completion criteria
- **Spec file:** `ux/tasks/<feature>.task-flow.json`
  - Top-level keys: `feature_id, task_id, actor, preconditions, steps, system_responses, completion_criteria, failure_paths`
- **Correctness gates:**
  - Every task step has a unique order index, actor, action type, and expected system response.
  - Every step maps to a valid screen region, control ID, or system event defined in wireframes or flows.
  - Every task declares explicit completion criteria and at least one failure or exit path.
  - No step references a control or route absent from upstream UX artifacts.
  - Parallel actor steps are explicitly marked; implicit concurrency is forbidden.
- **Dependencies:** `ux-user-flow`, `ux-screen-map`
- **Downstream consumers:** `ux-usability-evidence`, `ux-wireframe-manifest`, `ux-copy-structure`, `ux-destructive-action`
- **Error codes:**
  - `UX116 Unknown control reference`
  - `UX117 Completion criteria missing`
  - `UX118 Undefined parallel step`
- **Key invariant:** Fail if a task cannot be executed as an ordered, machine-checkable sequence of actions and responses.
- **Safe default:** Infer one primary action sequence from the happy path of the user flow.

### 7. Form Flow Spec (`ux-form-flow`)

- **Name:** Form Flow Spec
- **Frequency:** per-feature
- **Input:** Form intent, screen map, user flow, form schema, endpoint contract, validation rules
- **Output:** Form behavior spec covering fields, validation, submission, save, and error handling
- **Spec file:** `ux/forms/<feature>.form-flow.json`
  - Top-level keys: `feature_id, form_id, fields, validation_states, submission, draft_behavior, error_mapping, success_targets`
- **Correctness gates:**
  - Every form spec references an existing react-form artifact or declares the missing dependency explicitly.
  - Every field has an ID, input type, source, requiredness, and validation state mapping.
  - Every server-side validation or error code exposed by openapi or api-route is mapped to a user-visible state.
  - Submission paths define success, recoverable failure, unrecoverable failure, and cancellation outcomes.
  - Save-draft and autosave behavior, if enabled, have explicit trigger and conflict rules.
- **Dependencies:** `ux-user-flow`, `ux-screen-map`, `react-form`, `api-route`, `openapi-spec`
- **Downstream consumers:** `ux-multistep-flow`, `ux-state-matrix`, `ux-wireframe-manifest`, `ux-copy-structure`, `ux-parity-report`
- **Error codes:**
  - `UX119 Missing react-form mapping`
  - `UX120 Unmapped backend error`
  - `UX121 Submission outcome incomplete`
- **Key invariant:** Fail if a user can submit or validate a form without a complete user-visible outcome map.
- **Safe default:** Use single-screen submit with inline field errors and a generic submission failure banner.

### 8. Multi-Step Flow Spec (`ux-multistep-flow`)

- **Name:** Multi-Step Flow Spec
- **Frequency:** per-feature
- **Input:** Form flow, user flow, step definitions, persistence requirements, resume rules
- **Output:** Wizard or stepped-flow graph with progress, navigation, save, resume, and abandonment rules
- **Spec file:** `ux/flows/<feature>.multistep-flow.json`
  - Top-level keys: `feature_id, steps, transitions, progress_model, persistence, resume_logic, abandonment_rules, completion`
- **Correctness gates:**
  - Every step has a stable step ID, entry condition, exit condition, and owning route or screen.
  - Step transitions are acyclic unless an explicit review loop is declared.
  - Back navigation rules are defined for every non-initial step.
  - Abandonment, draft persistence, and resume destination are defined for every interruptible flow.
  - Completion criteria and post-completion route are explicit.
- **Dependencies:** `ux-form-flow`, `ux-user-flow`, `ux-screen-map`
- **Downstream consumers:** `ux-onboarding-flow`, `ux-returning-user-flow`, `ux-wireframe-manifest`, `ux-parity-report`
- **Error codes:**
  - `UX122 Step transition undefined`
  - `UX123 Resume rule missing`
  - `UX124 Completion target missing`
- **Key invariant:** Fail if a user can leave or resume a stepped flow without a deterministic return point.
- **Safe default:** Use a linear wizard that saves on each step and resumes at the last completed step.

### 9. Permission Branching Spec (`ux-permission-branching`)

- **Name:** Permission Branching Spec
- **Frequency:** per-feature
- **Input:** Roles, route inventory, guard policies, business permissions, protected actions
- **Output:** Structured branch matrix for role-based, auth-based, and state-based access behavior
- **Spec file:** `ux/permissions/<feature>.permission-branching.json`
  - Top-level keys: `feature_id, roles, resources, branches, route_guards, action_guards, fallbacks, escalations`
- **Correctness gates:**
  - Every protected route or action maps to an auth-middleware policy or a declared policy gap.
  - Every denied branch defines a fallback screen, message class, or escalation path.
  - No privileged screen or action is reachable from an unauthorized branch in the UX graph.
  - Role IDs and permission IDs are unique and typed.
  - Route guards and action guards are deterministic and non-contradictory.
- **Dependencies:** `ux-screen-map`, `ux-navigation-graph`, `auth-middleware`
- **Downstream consumers:** `ux-user-flow`, `ux-onboarding-flow`, `ux-returning-user-flow`, `ux-destructive-action`, `ux-parity-report`
- **Error codes:**
  - `UX125 Policy reference missing`
  - `UX126 Unauthorized reachable path`
  - `UX127 Denied fallback undefined`
- **Key invariant:** Fail if any protected route or action has no deterministic allow or deny UX branch.
- **Safe default:** Default to least privilege with a generic access-denied surface and safe return link.

### 10. Fallback and Recovery Flow Spec (`ux-recovery-flow`)

- **Name:** Fallback and Recovery Flow Spec
- **Frequency:** per-feature
- **Input:** State matrix, user flow, form flow, endpoint failure modes, offline policy
- **Output:** Structured recovery paths for errors, retries, abandoned flows, offline use, and support exits
- **Spec file:** `ux/recovery/<feature>.recovery-flow.json`
  - Top-level keys: `feature_id, failure_states, recovery_paths, retry_rules, data_preservation, offline_behavior, support_handoffs`
- **Correctness gates:**
  - Every recoverable failure state from the state matrix maps to at least one recovery path.
  - Every retry loop has a bounded retry policy or explicit backoff rule.
  - Every recovery path declares whether user input is preserved, discarded, or reconciled.
  - Offline states define read, write, and sync behavior explicitly.
  - Hard failure paths define an exit, support, or escalation destination.
- **Dependencies:** `ux-state-matrix`, `ux-user-flow`, `ux-form-flow`, `api-route`, `openapi-spec`
- **Downstream consumers:** `ux-copy-structure`, `ux-wireframe-manifest`, `ux-usability-evidence`, `ux-parity-report`
- **Error codes:**
  - `UX128 Recovery path missing`
  - `UX129 Unbounded retry loop`
  - `UX130 Data preservation policy missing`
- **Key invariant:** Fail if a surfaced failure state leaves the user without a defined next action.
- **Safe default:** Offer one retry, then return to the last stable screen with preserved inputs when possible.

### 11. Destructive Action Spec (`ux-destructive-action`)

- **Name:** Destructive Action Spec
- **Frequency:** per-feature
- **Input:** Task flows, permission rules, data model, risk classification, state matrix
- **Output:** Confirmation, undo, irreversible action, and post-action outcome model
- **Spec file:** `ux/actions/<feature>.destructive-actions.json`
  - Top-level keys: `feature_id, actions, risk_levels, confirmations, undo_rules, post_action_states, permissions`
- **Correctness gates:**
  - Every destructive action is classified as reversible or irreversible.
  - Risk level determines confirmation pattern, and the pattern is explicitly declared.
  - Post-action success, failure, and rollback states are defined for every action.
  - If undo is available, the undo window and scope are explicit; if not, absence is explicit.
  - Every destructive action references a valid permission branch.
- **Dependencies:** `ux-task-flow`, `ux-permission-branching`, `ux-state-matrix`
- **Downstream consumers:** `ux-copy-structure`, `ux-wireframe-manifest`, `ux-parity-report`
- **Error codes:**
  - `UX131 Risk classification missing`
  - `UX132 Undo rule undefined`
  - `UX133 Permission branch absent`
- **Key invariant:** Fail if a destructive action can occur without an explicit confirmation or declared safe exception.
- **Safe default:** Use a blocking confirmation dialog with explicit object name, cancel default, and no destructive default focus.

### 12. Onboarding Flow Spec (`ux-onboarding-flow`)

- **Name:** Onboarding Flow Spec
- **Frequency:** per-feature
- **Input:** Journey map, user flow, account states, permission prompts, setup requirements
- **Output:** First-time user path with orientation, setup, skip, resume, and completion rules
- **Spec file:** `ux/onboarding/<feature>.onboarding-flow.json`
  - Top-level keys: `feature_id, entry_conditions, steps, permissions, skip_rules, resume_rules, completion_flags, post_onboarding_route`
- **Correctness gates:**
  - Entry conditions for first-time users are explicit and mutually exclusive with returning-user entry conditions.
  - Every permission request appears before the first dependent interaction.
  - Skip behavior and resume behavior are defined for every optional onboarding step.
  - Completion writes a stable completion flag or milestone.
  - Completed users cannot re-enter first-run-only screens unless a reset rule exists.
- **Dependencies:** `ux-journey-map`, `ux-user-flow`, `ux-permission-branching`, `ux-multistep-flow`
- **Downstream consumers:** `ux-returning-user-flow`, `ux-navigation-graph`, `ux-wireframe-manifest`, `ux-experiment-variant-flow`, `ux-parity-report`
- **Error codes:**
  - `UX134 Entry condition collision`
  - `UX135 Completion flag undefined`
  - `UX136 Permission sequencing invalid`
- **Key invariant:** Fail if a first-time user can reach a required activation point without the required setup steps.
- **Safe default:** Provide a short optional setup sequence with skip, resume later, and dashboard fallback.

### 13. Returning User Flow Spec (`ux-returning-user-flow`)

- **Name:** Returning User Flow Spec
- **Frequency:** per-feature
- **Input:** Journey map, onboarding status, user history, unfinished work markers, personalization rules
- **Output:** Re-entry rules for previously seen users, including resume, personalization, and stale-state handling
- **Spec file:** `ux/returning/<feature>.returning-user-flow.json`
  - Top-level keys: `feature_id, cohorts, entry_rules, resume_targets, stale_state_rules, personalization, fallback_route`
- **Correctness gates:**
  - Returning-user cohorts are explicitly defined and disjoint enough to choose a deterministic destination.
  - Resume targets reference valid screens or steps.
  - Unfinished, stale, completed, and revoked states each define a destination rule.
  - Users with completed onboarding do not re-enter first-run screens unless a reset condition is true.
  - Fallback route exists if no resume or personalization rule matches.
- **Dependencies:** `ux-journey-map`, `ux-onboarding-flow`, `ux-navigation-graph`, `ux-multistep-flow`
- **Downstream consumers:** `ux-dashboard-hierarchy`, `ux-wireframe-manifest`, `ux-experiment-variant-flow`, `ux-parity-report`
- **Error codes:**
  - `UX137 Cohort rule ambiguous`
  - `UX138 Invalid resume target`
  - `UX139 Returning fallback missing`
- **Key invariant:** Fail if the same returning-user state can resolve to multiple first screens without a priority rule.
- **Safe default:** Route the user to the last successful primary destination or the default dashboard.

### 14. Search, Filter, and Sort Spec (`ux-search-filter-sort`)

- **Name:** Search, Filter, and Sort Spec
- **Frequency:** per-feature
- **Input:** Entity model, IA, listing screens, query capabilities, business defaults
- **Output:** Machine-readable interaction model for search inputs, filters, sorting, persistence, and zero-results behavior
- **Spec file:** `ux/search/<feature>.search-filter-sort.json`
  - Top-level keys: `feature_id, entities, query_model, filters, sorts, persistence, zero_results, permissions`
- **Correctness gates:**
  - Every searchable entity and searchable field is explicitly declared.
  - Every filter has an ID, data type, operator set, default state, and reset behavior.
  - Sort options are deterministic and mutually identifiable by stable IDs.
  - Zero-results state is distinct from pre-search empty state.
  - URL or session persistence rules are defined for all persisted controls.
- **Dependencies:** `ux-information-architecture`, `ux-screen-map`, `api-route`, `openapi-spec`
- **Downstream consumers:** `ux-data-table-model`, `ux-wireframe-manifest`, `ux-copy-structure`, `ux-parity-report`
- **Error codes:**
  - `UX140 Filter operator undefined`
  - `UX141 Zero-results state conflated`
  - `UX142 Persistence rule missing`
- **Key invariant:** Fail if a user can apply a search or filter state that has no deterministic visible representation or reset path.
- **Safe default:** Use text search, one default sort, and a clear-all action with non-persistent filters.

### 15. Data Table Interaction Model (`ux-data-table-model`)

- **Name:** Data Table Interaction Model
- **Frequency:** per-feature
- **Input:** Search spec, permissions, state matrix, data schema, row actions
- **Output:** Structured spec for columns, row actions, bulk actions, selection, pagination, and table states
- **Spec file:** `ux/tables/<feature>.data-table.json`
  - Top-level keys: `feature_id, table_id, columns, selection, row_actions, bulk_actions, pagination, state_refs`
- **Correctness gates:**
  - Column IDs are unique and columns have stable order or explicit user-reorder rules.
  - Sortable and filterable columns align with the search-filter-sort spec.
  - Row and bulk actions reference permission branches and post-action states.
  - Table loading, empty, partial, error, and offline states map to the state matrix.
  - Selection scope and pagination behavior are explicit.
- **Dependencies:** `ux-search-filter-sort`, `ux-state-matrix`, `ux-permission-branching`
- **Downstream consumers:** `ux-wireframe-manifest`, `ux-copy-structure`, `react-component`, `ux-parity-report`
- **Error codes:**
  - `UX143 Duplicate column ID`
  - `UX144 Bulk action permission missing`
  - `UX145 State mapping incomplete`
- **Key invariant:** Fail if any selectable row action lacks permission and post-action outcome coverage.
- **Safe default:** Use paginated read-only rows with single-row action menu and no bulk actions.

### 16. Dashboard Information Hierarchy Spec (`ux-dashboard-hierarchy`)

- **Name:** Dashboard Information Hierarchy Spec
- **Frequency:** per-feature
- **Input:** Returning-user rules, IA priorities, metrics inventory, module definitions, state matrix
- **Output:** Priority model for dashboard modules, summaries, drill-downs, and conditional visibility
- **Spec file:** `ux/dashboards/<feature>.dashboard-hierarchy.json`
  - Top-level keys: `feature_id, audiences, modules, priority_order, visibility_rules, summaries, state_variants`
- **Correctness gates:**
  - Every dashboard module has a stable module ID, audience, priority, and owning route.
  - No two modules claim the same slot without an explicit ordering rule.
  - Each module declares empty, loading, partial, and error variants where applicable.
  - Conditional visibility rules are typed as role, data-state, experiment, or personalization rules.
  - Every drill-down target references an existing screen or route.
- **Dependencies:** `ux-information-architecture`, `ux-returning-user-flow`, `ux-state-matrix`
- **Downstream consumers:** `ux-wireframe-manifest`, `ux-copy-structure`, `ux-experiment-variant-flow`, `ux-parity-report`
- **Error codes:**
  - `UX146 Module priority collision`
  - `UX147 Drill-down target invalid`
  - `UX148 Missing state variant for module`
- **Key invariant:** Fail if dashboard prominence rules cannot deterministically order visible modules for a given audience.
- **Safe default:** Render a single-column dashboard sorted by fixed priority with one top summary module.

### 17. Localization and RTL Constraint Spec (`ux-locale-layout-constraints`)

- **Name:** Localization and RTL Constraint Spec
- **Frequency:** per-feature
- **Input:** Copy structure, wireframes, locale list, route labels, icon set directionality rules
- **Output:** Locale-aware structural constraints for text expansion, truncation, mirroring, and locale-specific branches
- **Spec file:** `ux/locales/<feature>.locale-layout-constraints.json`
  - Top-level keys: `feature_id, locales, text_budgets, rtl_rules, directional_elements, locale_branches, fallbacks`
- **Correctness gates:**
  - Every primary text container has an expansion budget or truncation fallback.
  - RTL mirroring rules exist for every mirrored region, nav container, and directional element.
  - Locale-specific flow differences are explicit and scoped by locale ID.
  - Directional icons and progress indicators are classified as mirrored or fixed.
  - No locale is declared active without a fallback path for unsupported structural cases.
- **Dependencies:** `ux-copy-structure`, `ux-wireframe-manifest`, `i18n`
- **Downstream consumers:** `ux-responsive-structure`, `react-page`, `react-component`, `ux-parity-report`
- **Error codes:**
  - `UX149 Expansion budget missing`
  - `UX150 RTL rule absent`
  - `UX151 Locale branch unsupported`
- **Key invariant:** Fail if any active locale can break layout direction or text fit without a declared fallback.
- **Safe default:** Apply a 30 percent text expansion budget and full horizontal mirroring except for explicitly fixed media and charts.

### 18. Responsive Structure Spec (`ux-responsive-structure`)

- **Name:** Responsive Structure Spec
- **Frequency:** per-feature
- **Input:** Wireframes, navigation graph, locale constraints, state matrix, breakpoint policy
- **Output:** Breakpoint-aware structural behavior for layout, navigation mode, region order, and hidden-to-disclosed controls
- **Spec file:** `ux/responsive/<feature>.responsive-structure.json`
  - Top-level keys: `feature_id, breakpoints, screens, layout_rules, region_reordering, nav_modes, control_disclosure, state_rules`
- **Correctness gates:**
  - Every in-scope screen has a layout rule for each required breakpoint.
  - If a control is hidden at a breakpoint, an alternate visible trigger must exist.
  - Region reordering cannot break the defined task completion path.
  - Navigation mode is explicit for every breakpoint and screen family.
  - State-specific layouts are declared where responsive behavior differs by runtime state.
- **Dependencies:** `ux-wireframe-manifest`, `ux-navigation-graph`, `ux-locale-layout-constraints`, `ux-state-matrix`
- **Downstream consumers:** `react-page`, `react-component`, `ux-parity-report`
- **Error codes:**
  - `UX152 Breakpoint rule missing`
  - `UX153 Hidden control without alternate trigger`
  - `UX154 Task path broken by reordering`
- **Key invariant:** Fail if any required action disappears at a supported breakpoint without an equivalent path.
- **Safe default:** Collapse to a single-column stacked layout with overflow menus on the smallest breakpoint.

### 19. Information Architecture Schema (`ux-information-architecture`)

- **Name:** Information Architecture Schema
- **Frequency:** per-project
- **Input:** Product brief, domain entities, content model, business capabilities, existing routes if any
- **Output:** Structured model of information objects, hierarchies, taxonomies, and retrieval paths
- **Spec file:** `ux/ia/app.ia.json`
  - Top-level keys: `app_id, domains, objects, taxonomies, relationships, entry_points, constraints`
- **Correctness gates:**
  - Every information object has a stable object ID, type, and ownership domain.
  - Taxonomy terms are unique within a taxonomy and have explicit parent or root references.
  - Relationships reference valid object IDs and allowed cardinalities.
  - Every top-level navigation destination maps to an IA object or taxonomy node.
  - No orphan object exists without an access path or explicit archival flag.
- **Dependencies:** None required
- **Downstream consumers:** `ux-screen-map`, `ux-navigation-graph`, `ux-search-filter-sort`, `ux-dashboard-hierarchy`, `ux-copy-structure`
- **Error codes:**
  - `UX155 Orphan IA object`
  - `UX156 Invalid relationship cardinality`
  - `UX157 Nav destination not backed by IA`
- **Key invariant:** Fail if any navigable surface exposes information that has no place in the architecture schema.
- **Safe default:** Use a flat IA with one primary collection, one detail type, and one global search entry point.

### 20. Screen Map Spec (`ux-screen-map`)

- **Name:** Screen Map Spec
- **Frequency:** per-project
- **Input:** IA schema, product scope, route inventory, feature list, actor list
- **Output:** Canonical inventory of screens, routes, route patterns, and screen families
- **Spec file:** `ux/screens/app.screen-map.json`
  - Top-level keys: `app_id, screens, route_patterns, screen_families, entry_screens, terminal_screens, ownership`
- **Correctness gates:**
  - Every screen has a stable screen ID, route pattern or external surface ID, and screen family.
  - Route patterns are unique and non-overlapping unless explicit priority rules exist.
  - Entry screens and terminal screens are typed and declared.
  - Every implemented react-page route maps to exactly one screen-map node or is marked technical and excluded.
  - No screen family is empty.
- **Dependencies:** `ux-information-architecture`
- **Downstream consumers:** `ux-navigation-graph`, `ux-user-flow`, `ux-state-matrix`, `ux-wireframe-manifest`, `ux-parity-report`
- **Error codes:**
  - `UX158 Duplicate route pattern`
  - `UX159 Route not mapped to screen`
  - `UX160 Screen family empty`
- **Key invariant:** Fail if the product contains a route or surface that cannot be named as a canonical screen.
- **Safe default:** Infer one screen per known route and group unmatched surfaces into a temporary utility family.

### 21. Structured Journey Map (`ux-journey-map`)

- **Name:** Structured Journey Map
- **Frequency:** per-project
- **Input:** Actors, goals, major scenarios, channels, constraints, screen map
- **Output:** Stage-based multi-role journey artifact linking goals, touchpoints, and outcomes
- **Spec file:** `ux/journeys/app.journey-map.json`
  - Top-level keys: `app_id, journeys, actors, stages, touchpoints, screen_refs, outcomes, handoffs`
- **Correctness gates:**
  - Every journey has a stable actor, goal, stage sequence, and measurable outcome.
  - Every stage references at least one screen, touchpoint, or explicit off-product touchpoint.
  - Multi-role journeys declare handoff points and responsibility changes explicitly.
  - Every journey ends in success, dropout, escalation, or handoff.
  - Stage order is deterministic.
- **Dependencies:** `ux-screen-map`
- **Downstream consumers:** `ux-onboarding-flow`, `ux-returning-user-flow`, `ux-user-flow`, `ux-usability-evidence`
- **Error codes:**
  - `UX161 Outcome missing`
  - `UX162 Handoff undefined`
  - `UX163 Stage reference invalid`
- **Key invariant:** Fail if a journey cannot be reduced to an ordered set of stages with explicit actor ownership.
- **Safe default:** Model a single-actor linear journey from entry screen to primary success outcome.

### 22. Navigation Logic Graph (`ux-navigation-graph`)

- **Name:** Navigation Logic Graph
- **Frequency:** per-project
- **Input:** IA schema, screen map, app shell model, entry points, global nav requirements
- **Output:** Typed navigation graph covering menus, deep links, back behavior, and shell transitions
- **Spec file:** `ux/navigation/app.navigation-graph.json`
  - Top-level keys: `app_id, nodes, edges, primary_nav, secondary_nav, deep_links, back_behavior, shells`
- **Correctness gates:**
  - Every nav node references a valid screen-map node.
  - Every edge has a trigger type and a destination.
  - Every non-entry screen has either a back path, an explicit parent shell, or a terminal classification.
  - Primary navigation items are unique and ordered.
  - No deep link targets a screen that is not reachable in at least one valid branch.
- **Dependencies:** `ux-information-architecture`, `ux-screen-map`
- **Downstream consumers:** `ux-user-flow`, `ux-permission-branching`, `ux-responsive-structure`, `ux-wireframe-manifest`, `ux-parity-report`
- **Error codes:**
  - `UX164 Unknown nav node`
  - `UX165 Edge destination missing`
  - `UX166 Back behavior undefined`
- **Key invariant:** Fail if a reachable screen cannot be entered and exited through explicit navigation rules.
- **Safe default:** Use a simple tree navigation model derived from screen family hierarchy.

### 23. Experiment Variant Flow Spec (`ux-experiment-variant-flow`)

- **Name:** Experiment Variant Flow Spec
- **Frequency:** per-experiment
- **Input:** Base flow, hypothesis, experiment scope, feature flags, success metric IDs
- **Output:** Control and treatment flow variants with exposure, branching, and rollback rules
- **Spec file:** `ux/experiments/<experiment>.variant-flow.json`
  - Top-level keys: `experiment_id, base_flow_ref, variants, feature_flag_refs, entry_rules, metrics, rollback_rules`
- **Correctness gates:**
  - Every variant references an existing feature-flag or declared experiment router input.
  - Control and treatment variants share a common base flow reference and success metric IDs.
  - Exposure scope is explicit by audience, route, or event.
  - Unsupported states inherit from the base flow through explicit inheritance rules.
  - Rollback or experiment-off behavior returns to the base flow deterministically.
- **Dependencies:** `ux-user-flow`, `ux-copy-structure`, `feature-flag`
- **Downstream consumers:** `react-page`, `analytics-event`, `ux-usability-evidence`, `ux-parity-report`
- **Error codes:**
  - `UX167 Feature flag ref missing`
  - `UX168 Variant inheritance undefined`
  - `UX169 Rollback path missing`
- **Key invariant:** Fail if enabling or disabling an experiment can strand the user between incompatible flow states.
- **Safe default:** Ship the control flow only and treat all treatment nodes as inherited from control until defined.

### 24. Usability Evidence Report (`ux-usability-evidence`)

- **Name:** Usability Evidence Report
- **Frequency:** per-experiment
- **Input:** Task flows, wireframes or implemented routes, test sessions, coded observations, issue taxonomy
- **Output:** Machine-checkable evidence report linking observed issues to exact tasks, screens, and severities
- **Spec file:** `ux/research/<study>.usability-evidence.json`
  - Top-level keys: `study_id, tasks, participants, observations, issues, severity, evidence_refs, target_artifacts`
- **Correctness gates:**
  - Every issue links to a valid task-flow step, screen ID, or route ID.
  - Severity uses a fixed taxonomy and frequency count is numeric.
  - Every issue has at least one evidence reference and one target artifact for remediation.
  - Duplicate issues are merged by rule or explicitly kept distinct with rationale.
  - Pass/fail summary exists for each evaluated task.
- **Dependencies:** `ux-task-flow`, `ux-wireframe-manifest`, `react-page`
- **Downstream consumers:** `ux-user-flow`, `ux-copy-structure`, `ux-wireframe-manifest`, `ux-parity-report`
- **Error codes:**
  - `UX170 Issue not linked to artifact`
  - `UX171 Severity taxonomy invalid`
  - `UX172 Task result missing`
- **Key invariant:** Fail if an observed usability issue cannot be traced to a precise UX artifact or task step.
- **Safe default:** Record no automated findings and require manual review before using the study for release decisions.

## Recommended build order

The UX compiler network should not be built in the same order as a UX team works. It should be built in dependency order, while still prioritizing the highest-frequency artifacts as early as possible once their prerequisites exist.

### Wave 1: Foundational topology

Build these first because almost everything else references them:

1. `ux-information-architecture`
2. `ux-screen-map`
3. `ux-navigation-graph`
4. `ux-journey-map`

### Wave 2: Core behavioral flow compilers

These define the behavioral backbone of the product:

5. `ux-user-flow`
6. `ux-task-flow`
7. `ux-permission-branching`
8. `ux-form-flow`
9. `ux-multistep-flow`

### Wave 3: State and recovery coverage

These make the system robust instead of happy-path only:

10. `ux-state-matrix`
11. `ux-recovery-flow`
12. `ux-destructive-action`
13. `ux-onboarding-flow`
14. `ux-returning-user-flow`

### Wave 4: High-frequency delivery artifacts

These are the artifacts most often updated during active feature work:

15. `ux-wireframe-manifest`
16. `ux-copy-structure`
17. `ux-locale-layout-constraints`
18. `ux-responsive-structure`

### Wave 5: Pattern-specific interaction compilers

Add these once the core flow and state system is stable:

19. `ux-search-filter-sort`
20. `ux-data-table-model`
21. `ux-dashboard-hierarchy`

### Wave 6: Experimentation and verification

These close the loop between intent, shipped behavior, and observed evidence:

22. `ux-experiment-variant-flow`
23. `ux-usability-evidence`
24. `ux-parity-report`

## Minimal prerequisite graph

- `ux-information-architecture` -> `ux-screen-map` -> `ux-navigation-graph` -> `ux-user-flow`
- `ux-user-flow` -> `ux-task-flow`, `ux-form-flow`, `ux-state-matrix`, `ux-wireframe-manifest`
- `ux-form-flow` -> `ux-multistep-flow` -> `ux-onboarding-flow`, `ux-returning-user-flow`
- `ux-state-matrix` -> `ux-recovery-flow`, `ux-wireframe-manifest`, `ux-copy-structure`
- `ux-wireframe-manifest` + `ux-copy-structure` -> `ux-locale-layout-constraints` -> `ux-responsive-structure`
- `ux-search-filter-sort` -> `ux-data-table-model`
- `ux-user-flow` + `feature-flag` -> `ux-experiment-variant-flow`
- All major UX artifacts + implementation manifests -> `ux-parity-report`

## Practical priority order if you want daily-value compilers first

If the goal is to get useful compilers into daily feature work as early as possible, the best first tranche is:

1. `ux-screen-map`
2. `ux-navigation-graph`
3. `ux-user-flow`
4. `ux-state-matrix`
5. `ux-wireframe-manifest`
6. `ux-copy-structure`
7. `ux-form-flow`
8. `ux-permission-branching`
9. `ux-recovery-flow`
10. `ux-parity-report`

That set gives you the smallest useful closed loop: structure -> flow -> state coverage -> handoff -> verification.