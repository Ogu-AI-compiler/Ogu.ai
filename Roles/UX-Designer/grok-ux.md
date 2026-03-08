UX Designer Compiler Network
Overview
This document decomposes the UX designer role into atomic, repeatable task types suitable for implementation as compilers in a Domain Compiler Network. Each compiler takes an intent (spec) as input and produces a verified, attested artifact. The focus is on UX artifacts that define behavior, structure, flow, and state coverage for digital products, treating UX as a formal system. Artifacts are machine-checkable, such as JSON specs, manifests, matrices, graphs, and reports.
Excluded are already-built compilers (e.g., react-component, react-page) and shared ones (e.g., utility-fn, feature-flag). Dependencies and downstream consumers reference these where relevant, including cross-compiler checks (e.g., user-flow specs must align with react-page artifacts).
The decomposition is exhaustive, covering core areas and edge cases like empty/loading/error/offline states, permissions-based UI branches, multi-role journeys, localization/RTL impacts, first-time vs. returning users, multi-step/abandoned/retry flows, destructive actions, route guards/not-found, partial data, experiment variants, and mismatches between UX flows and route/state graphs.
Tasks are prioritized by frequency: daily (few, if any), per-feature, per-project, per-experiment.
Summary Table

Task Name (Compiler ID)FrequencyInputOutputuser-flow-compilerper-featureFeature intent spec, including user goalsuser_flow.json (flow graph)task-flow-compilerper-featureTask breakdown spectask_flow.json (step sequences)state-matrix-compilerper-featurePage/component specstate_matrix.json (state coverage)form-flow-compilerper-featureForm intent specform_flow.json (multi-step logic)permission-branch-compilerper-featurePermission model specpermission_branches.json (branching rules)search-ux-compilerper-featureSearch feature specsearch_patterns.json (interaction rules)table-interaction-compilerper-featureData table spectable_model.json (interaction model)dashboard-hierarchy-compilerper-featureDashboard content specdashboard_hierarchy.json (info structure)destructive-action-compilerper-featureAction intent specdestructive_patterns.json (confirmation rules)recovery-flow-compilerper-featureFailure scenarios specrecovery_flows.json (fallback paths)handoff-annotation-compilerper-featureBehavior intent specbehavior_annotations.json (flow notes)copy-structure-compilerper-featureContent hierarchy speccopy_hierarchy.json (text structure)sitemap-compilerper-projectProject structure specsitemap.json (screen map)navigation-compilerper-projectRoute inventorynavigation_graph.json (logic graph)onboarding-compilerper-projectUser entry speconboarding_flow.json (first-time paths)returning-user-compilerper-projectRetention specreturning_flow.json (repeat paths)localization-constraint-compilerper-projectLocalization requirementsloc_constraints.json (flow adjustments)rtl-structure-compilerper-projectRTL requirementsrtl_constraints.json (structural flips)responsive-spec-compilerper-projectBreakpoint specresponsive_rules.json (structural behaviors)ab-variant-compilerper-experimentExperiment hypothesis specvariant_flows.json (A/B paths)flow-mismatch-report-compilerper-experimentUX flow and implementation artifactsmismatch_report.json (discrepancy analysis)
Detailed Breakdown
user-flow-compiler

Name: user-flow-compiler
Frequency: per-feature
Input: Feature intent spec, including user goals, multi-role journeys, first-time vs. returning user distinctions.
Output: user_flow.json – a graph of user journeys with nodes (states) and edges (actions/transitions).
Correctness gates: Every flow terminates in success/failure state; no dead-end nodes; covers offline/partial data states; aligns with existing react-page artifacts (cross-check: all nodes reference valid pages).
Dependencies: react-page, api-route.
Downstream consumers: task-flow-compiler, state-matrix-compiler.
Spec file: user_flow_spec.json – defines goals, roles, and entry points.
Error codes: UX001 (unterminated flow), UX002 (missing role branch), UX003 (invalid page reference), UX004 (no offline coverage), UX005 (partial data ignored).
Key invariant: Compiler fails if any flow path lacks a defined termination state.
Safe default: Fallback to linear default flow based on api-route sequence, without branches.

task-flow-compiler

Name: task-flow-compiler
Frequency: per-feature
Input: Task breakdown spec, including multi-step sequences, abandoned flows, retry loops.
Output: task_flow.json – sequenced steps with branches for errors/retries.
Correctness gates: All steps have next/previous links; retry loops capped (e.g., max 3); abandoned flows have recovery entry; maps to user-flow nodes.
Dependencies: user-flow-compiler.
Downstream consumers: form-flow-compiler, recovery-flow-compiler.
Spec file: task_flow_spec.json – lists tasks, steps, and loop conditions.
Error codes: UX006 (uncapped loop), UX007 (missing retry), UX008 (abandoned without recovery), UX009 (step mismatch with user flow), UX010 (no error branch).
Key invariant: Compiler fails if any task sequence allows infinite loops.
Safe default: Single-step task with immediate success, ignoring branches.

state-matrix-compiler

Name: state-matrix-compiler
Frequency: per-feature
Input: Page/component spec, including queries/states.
Output: state_matrix.json – matrix covering empty/loading/error/success/offline/partial states per element.
Correctness gates: Every query/state has all matrix cells filled; binary checks for coverage; cross-checks against react-page queries (all states addressed).
Dependencies: react-page, user-flow-compiler.
Downstream consumers: handoff-annotation-compiler.
Spec file: state_matrix_spec.json – defines elements and state types.
Error codes: UX011 (incomplete matrix), UX012 (missing empty state), UX013 (no loading indicator), UX014 (error state undefined), UX015 (offline ignored).
Key invariant: Compiler fails if any state cell is empty for a defined element.
Safe default: Generic "loading..." for all states, without customization.

form-flow-compiler

Name: form-flow-compiler
Frequency: per-feature
Input: Form intent spec, including multi-step logic, validation branches.
Output: form_flow.json – flow for steps, validations, and branches.
Correctness gates: All fields have validation rules; multi-step has progress tracking; aligns with react-form artifacts (cross-check: fields match).
Dependencies: react-form, task-flow-compiler.
Downstream consumers: permission-branch-compiler.
Spec file: form_flow_spec.json – outlines steps, fields, and validations.
Error codes: UX016 (missing validation), UX017 (step without progress), UX018 (field mismatch with react-form), UX019 (no branch for invalid), UX020 (abandoned form ignored).
Key invariant: Compiler fails if any form step lacks validation for required fields.
Safe default: Single-page form without steps or branches.

permission-branch-compiler

Name: permission-branch-compiler
Frequency: per-feature
Input: Permission model spec, including UI branches, multi-role.
Output: permission_branches.json – branching rules based on auth levels.
Correctness gates: All branches reference valid flows; no unprotected paths; cross-checks with auth-middleware (all rules align).
Dependencies: auth-middleware, user-flow-compiler.
Downstream consumers: navigation-compiler.
Spec file: permission_branch_spec.json – defines roles and access rules.
Error codes: UX021 (unprotected branch), UX022 (invalid flow reference), UX023 (role mismatch with auth), UX024 (no denied state), UX025 (multi-role conflict).
Key invariant: Compiler fails if any branch allows access without required permission.
Safe default: Deny-all branches, redirecting to login.

search-ux-compiler

Name: search-ux-compiler
Frequency: per-feature
Input: Search feature spec, including filter/sort patterns.
Output: search_patterns.json – rules for interactions, results handling.
Correctness gates: Covers empty/no-results states; filter combos defined; aligns with api-route for queries.
Dependencies: api-route, state-matrix-compiler.
Downstream consumers: table-interaction-compiler.
Spec file: search_ux_spec.json – details filters, sorts, and result states.
Error codes: UX026 (missing no-results), UX027 (undefined filter combo), UX028 (query mismatch with api), UX029 (sort without order), UX030 (partial results ignored).
Key invariant: Compiler fails if search lacks handling for zero results.
Safe default: Basic text search without filters or sorts.

table-interaction-compiler

Name: table-interaction-compiler
Frequency: per-feature
Input: Data table spec, including interactions.
Output: table_model.json – model for paging, sorting, selections.
Correctness gates: All interactions have states (e.g., loading); paging limits defined; cross-checks with search-ux if applicable.
Dependencies: search-ux-compiler.
Downstream consumers: dashboard-hierarchy-compiler.
Spec file: table_interaction_spec.json – defines columns, actions.
Error codes: UX031 (missing paging), UX032 (no selection state), UX033 (interaction without loading), UX034 (sort conflict), UX035 (empty table undefined).
Key invariant: Compiler fails if table lacks paging for >10 rows.
Safe default: Static table without interactions.

dashboard-hierarchy-compiler

Name: dashboard-hierarchy-compiler
Frequency: per-feature
Input: Dashboard content spec.
Output: dashboard_hierarchy.json – structured info hierarchy.
Correctness gates: Hierarchy acyclic; all nodes have priorities; covers partial data states.
Dependencies: state-matrix-compiler.
Downstream consumers: responsive-spec-compiler.
Spec file: dashboard_hierarchy_spec.json – lists sections and priorities.
Error codes: UX036 (cyclic hierarchy), UX037 (missing priority), UX038 (no partial data), UX039 (unlinked node), UX040 (overload sections).
Key invariant: Compiler fails if hierarchy contains cycles.
Safe default: Flat list without hierarchy.

destructive-action-compiler

Name: destructive-action-compiler
Frequency: per-feature
Input: Action intent spec.
Output: destructive_patterns.json – confirmation rules, undo options.
Correctness gates: All actions require confirmation; undo paths defined; no auto-confirm.
Dependencies: task-flow-compiler.
Downstream consumers: recovery-flow-compiler.
Spec file: destructive_action_spec.json – identifies actions and risks.
Error codes: UX041 (no confirmation), UX042 (missing undo), UX043 (auto-confirm allowed), UX044 (risk unassessed), UX045 (recovery link broken).
Key invariant: Compiler fails if any destructive action lacks confirmation step.
Safe default: Block destructive actions entirely.

recovery-flow-compiler

Name: recovery-flow-compiler
Frequency: per-feature
Input: Failure scenarios spec, including error/offline.
Output: recovery_flows.json – paths for fallbacks, retries.
Correctness gates: Every failure has recovery; cross-checks against api-route errors (all covered); retry limits set.
Dependencies: state-matrix-compiler, api-route.
Downstream consumers: handoff-annotation-compiler.
Spec file: recovery_flow_spec.json – lists failures and recoveries.
Error codes: UX046 (uncovered failure), UX047 (no retry limit), UX048 (error mismatch with api), UX049 (offline without fallback), UX050 (retry loop infinite).
Key invariant: Compiler fails if any known failure lacks a recovery path.
Safe default: Generic error page redirect.

handoff-annotation-compiler

Name: handoff-annotation-compiler
Frequency: per-feature
Input: Behavior intent spec.
Output: behavior_annotations.json – structured notes on flows/states.
Correctness gates: All annotations reference valid artifacts; no subjective notes; binary coverage check.
Dependencies: user-flow-compiler, state-matrix-compiler.
Downstream consumers: ab-variant-compiler.
Spec file: handoff_annotation_spec.json – defines behaviors to annotate.
Error codes: UX051 (invalid reference), UX052 (subjective content), UX053 (missing coverage), UX054 (duplicate annotation), UX055 (flow mismatch).
Key invariant: Compiler fails if annotation references non-existent artifact.
Safe default: Empty annotations, relying on raw artifacts.

copy-structure-compiler

Name: copy-structure-compiler
Frequency: per-feature
Input: Content hierarchy spec.
Output: copy_hierarchy.json – structured text with placeholders.
Correctness gates: All copy has i18n placeholders; hierarchy matches flows; cross-checks with i18n.
Dependencies: i18n, user-flow-compiler.
Downstream consumers: localization-constraint-compiler.
Spec file: copy_structure_spec.json – outlines text nodes and hierarchies.
Error codes: UX056 (missing placeholder), UX057 (hierarchy mismatch), UX058 (no i18n align), UX059 (overlong copy), UX060 (unstructured text).
Key invariant: Compiler fails if any copy lacks i18n interpolation.
Safe default: Placeholder text without structure.

sitemap-compiler

Name: sitemap-compiler
Frequency: per-project
Input: Project structure spec.
Output: sitemap.json – screen map graph.
Correctness gates: Acyclic graph; all screens linked; covers route-not-found.
Dependencies: react-page.
Downstream consumers: navigation-compiler, user-flow-compiler.
Spec file: sitemap_spec.json – lists screens and relations.
Error codes: UX061 (cyclic map), UX062 (isolated screen), UX063 (no not-found), UX064 (missing link), UX065 (duplicate screen).
Key invariant: Compiler fails if sitemap contains isolated nodes.
Safe default: Single home screen map.

navigation-compiler

Name: navigation-compiler
Frequency: per-project
Input: Route inventory.
Output: navigation_graph.json – logic with guards.
Correctness gates: All routes guarded; cross-checks with api-route (matches); covers not-found states.
Dependencies: sitemap-compiler, auth-middleware.
Downstream consumers: permission-branch-compiler.
Spec file: navigation_spec.json – defines routes and guards.
Error codes: UX066 (unguarded route), UX067 (route mismatch), UX068 (no guard for auth), UX069 (not-found missing), UX070 (guard conflict).
Key invariant: Compiler fails if any route lacks a guard.
Safe default: Locked navigation to home only.

onboarding-compiler

Name: onboarding-compiler
Frequency: per-project
Input: User entry spec.
Output: onboarding_flow.json – first-time paths.
Correctness gates: Terminates to main flow; skips for returning; aligns with user-flow.
Dependencies: user-flow-compiler.
Downstream consumers: returning-user-compiler.
Spec file: onboarding_spec.json – details entry steps.
Error codes: UX071 (no termination), UX072 (no skip option), UX073 (flow mismatch), UX074 (abandoned onboarding), UX075 (retry missing).
Key invariant: Compiler fails if onboarding doesn't link to main flow.
Safe default: Direct to main without onboarding.

returning-user-compiler

Name: returning-user-compiler
Frequency: per-project
Input: Retention spec.
Output: returning_flow.json – repeat paths.
Correctness gates: Branches from onboarding; covers session resume; no redundant steps.
Dependencies: onboarding-compiler.
Downstream consumers: None.
Spec file: returning_user_spec.json – defines resume points.
Error codes: UX076 (no branch from onboarding), UX077 (redundant step), UX078 (session ignore), UX079 (flow loop), UX080 (mismatch with user-flow).
Key invariant: Compiler fails if returning flow repeats onboarding steps.
Safe default: Treat all as first-time.

localization-constraint-compiler

Name: localization-constraint-compiler
Frequency: per-project
Input: Localization requirements.
Output: loc_constraints.json – flow adjustments for expansion.
Correctness gates: All flows checked for text overflow; placeholders enforced; cross-checks with i18n.
Dependencies: i18n, copy-structure-compiler.
Downstream consumers: rtl-structure-compiler.
Spec file: localization_constraint_spec.json – lists locales and impacts.
Error codes: UX081 (overflow ignored), UX082 (no placeholder), UX083 (i18n mismatch), UX084 (expansion break), UX085 (flow alter missing).
Key invariant: Compiler fails if any flow ignores text expansion.
Safe default: No locale adjustments, assume en-US.

rtl-structure-compiler

Name: rtl-structure-compiler
Frequency: per-project
Input: RTL requirements.
Output: rtl_constraints.json – structural flips.
Correctness gates: All layouts flipped; navigation reversed; cross-checks with responsive-spec.
Dependencies: localization-constraint-compiler.
Downstream consumers: None.
Spec file: rtl_structure_spec.json – defines RTL elements.
Error codes: UX086 (unflipped layout), UX087 (navigation not reversed), UX088 (structure break), UX089 (responsive conflict), UX090 (element ignore).
Key invariant: Compiler fails if any navigation isn't reversed for RTL.
Safe default: LTR-only structures.

responsive-spec-compiler

Name: responsive-spec-compiler
Frequency: per-project
Input: Breakpoint spec.
Output: responsive_rules.json – structural behaviors per device.
Correctness gates: All breakpoints defined; no content loss; covers hierarchy collapses.
Dependencies: dashboard-hierarchy-compiler.
Downstream consumers: rtl-structure-compiler.
Spec file: responsive_spec.json – lists breakpoints and rules.
Error codes: UX091 (missing breakpoint), UX092 (content loss), UX093 (hierarchy ignore), UX094 (device conflict), UX095 (rule invalid).
Key invariant: Compiler fails if any breakpoint causes content truncation.
Safe default: Desktop-only rules, no mobile adaptations.

ab-variant-compiler

Name: ab-variant-compiler
Frequency: per-experiment
Input: Experiment hypothesis spec.
Output: variant_flows.json – A/B paths.
Correctness gates: Variants map to feature-flag; no flow breaks; cross-checks with feature-flag artifacts.
Dependencies: feature-flag, user-flow-compiler.
Downstream consumers: flow-mismatch-report-compiler.
Spec file: ab_variant_spec.json – defines variants and flags.
Error codes: UX096 (flag mismatch), UX097 (flow break in variant), UX098 (no control group), UX099 (variant overlap), UX100 (experiment unterminated).
Key invariant: Compiler fails if variants don't align with flags.
Safe default: Single variant (control) only.

flow-mismatch-report-compiler

Name: flow-mismatch-report-compiler
Frequency: per-experiment
Input: UX flow and implementation artifacts.
Output: mismatch_report.json – discrepancy analysis.
Correctness gates: All mismatches listed; binary pass if zero; cross-checks against react-page/api-route graphs.
Dependencies: user-flow-compiler, navigation-compiler.
Downstream consumers: None.
Spec file: flow_mismatch_spec.json – references artifacts to compare.
Error codes: UX101 (unlisted mismatch), UX102 (false positive), UX103 (graph uncompared), UX104 (state ignore), UX105 (route discrepancy).
Key invariant: Compiler fails if report omits any detected mismatch.
Safe default: Assume no mismatches, skip report.

Recommended Build Order
Considering the dependency graph (e.g., foundational structures before feature flows) and priority (per-feature before per-project before per-experiment), the build order is:

Foundational per-feature (minimal deps): user-flow-compiler, state-matrix-compiler.
Per-feature extensions (depend on foundational): task-flow-compiler, form-flow-compiler, permission-branch-compiler, search-ux-compiler, table-interaction-compiler, dashboard-hierarchy-compiler, destructive-action-compiler, recovery-flow-compiler, handoff-annotation-compiler, copy-structure-compiler.
Per-project core (depend on per-feature or external): sitemap-compiler, navigation-compiler, onboarding-compiler, returning-user-compiler, localization-constraint-compiler, rtl-structure-compiler, responsive-spec-compiler.
Per-experiment (depend on all above): ab-variant-compiler, flow-mismatch-report-compiler.

This order ensures dependencies are resolved, starting with high-frequency (per-feature) compilers after minimal setups.
