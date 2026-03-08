# UI Designer Compiler Network

This document decomposes the UI designer role into atomic compiler-sized task types for a formal Domain Compiler Network.

The focus is on machine-checkable UI artifacts only: tokens, themes, visual rules, layout constraints, component appearance, state appearance, motion policy, and verification. Human process, subjective critique, raw screenshots, and frontend implementation details are intentionally excluded.

## Assumptions for cross-compiler validation

To keep the catalog concrete, the cross-compiler checks below assume the compiler network exposes machine-readable manifests such as:

- `react-component` component manifest with component IDs, slots, and supported variant hooks
- `react-form` form-control manifest with field IDs, field types, validation states, and composition rules
- `react-page` page and route manifest with surface IDs, breakpoint usage, route shells, and page regions
- `feature-flag` flag manifest for runtime experiment branching
- `i18n` locale and interpolation manifest for string expansion, placeholders, and directionality
- `a11y-test` policy manifest, when available, for contrast, focus, and reduced-motion enforcement
- UX compiler outputs, when available, such as `ux-wireframe-manifest`, `ux-state-matrix`, and `ux-responsive-structure`

If your filenames differ, keep the contracts and rename the artifacts.

## Summary table

| Task Name (Compiler ID) | Frequency | Input | Output |
|---|---|---|---|
| Component Variant Spec (`ui-component-variant-spec`) | daily | Approved component IDs, token system, theme manifest, UI requirements | Component visual variants and slot-level visual contracts |
| Component State Appearance Matrix (`ui-component-state-appearance`) | daily | Component variants, state requirements, semantic color map, interaction states | Per-component appearance matrix for default, hover, focus, active, disabled, selected, loading, error, and success |
| Form Field Visual Rules (`ui-form-field-visual-rules`) | daily | Form control manifest, component variants, validation states, theme manifest | Visual rules for text inputs, selects, checkboxes, radios, toggles, textareas, helpers, and validation surfaces |
| Handoff Annotation Spec (`ui-handoff-annotation`) | daily | Wireframes, component variants, responsive layout, motion spec | Structured implementation notes tied to exact surfaces, slots, and states |
| Design System Drift Report (`ui-design-system-drift-report`) | daily | Shipped component/page manifests, token system, variant specs, regression baselines | Pass or fail report for visual drift, unmanaged overrides, and token parity mismatches |
| Responsive Layout Spec (`ui-responsive-layout-spec`) | per-feature | Page surfaces, breakpoint registry, visual hierarchy rules, locale constraints | Breakpoint-aware layout behavior for each screen or surface |
| Grid Layout Spec (`ui-grid-layout-spec`) | per-feature | Responsive layout requirements, breakpoint registry, page regions | Formal grid, column, gutter, span, and region alignment rules |
| Skeleton Loading Spec (`ui-skeleton-loading-spec`) | per-feature | Async regions, state matrix, grid layout, theme manifest | Skeleton structures, sizes, shimmer policy, and terminal handoff rules |
| Feedback Visual Pattern Spec (`ui-feedback-visual-pattern-spec`) | per-feature | State matrix, semantic color map, copy structure, component variants | Visual patterns for empty, error, success, offline, partial, and not-found states |
| Overlay Presentation Spec (`ui-overlay-presentation-spec`) | per-feature | Page shells, component variants, motion spec, responsive layout | Visual rules for modal, drawer, popover, sheet, toast, and layered surfaces |
| Data Table Visual Spec (`ui-data-table-visual-spec`) | per-feature | Data schema, row actions, density rules, component variants, responsive layout | Table styling, density modes, sticky regions, row states, and overflow behavior |
| Dashboard Layout Density Spec (`ui-dashboard-layout-density-spec`) | per-feature | Dashboard hierarchy, metric modules, grid layout, breakpoint registry | Visual hierarchy and density rules for dashboards and other data-dense surfaces |
| Data Visualization Style Spec (`ui-data-viz-style-spec`) | per-feature | Chart inventory, semantic color map, typography scale, theme manifest | Style rules for charts, legends, axes, gridlines, empty states, and no-data surfaces |
| Motion Spec (`ui-motion-spec`) | per-feature | Component variants, overlays, page transitions, accessibility policy | Motion tokens, timing, easing, entry or exit rules, and reduced-motion overrides |
| Destructive Action Visual Spec (`ui-destructive-action-visual-spec`) | per-feature | Permission rules, state matrix, semantic color map, overlay rules | Visual contracts for destructive confirmations, undo surfaces, and irreversible states |
| Color Token Spec (`ui-color-token-spec`) | per-project | Brand constraints, accessibility policy, semantic roles, supported themes | Raw and alias color tokens with metadata and allowed usage |
| Typography Scale Spec (`ui-typography-scale-spec`) | per-project | Brand text constraints, platform targets, localization constraints | Type tokens, line-height pairs, tracking, casing policy, and text role mapping |
| Space and Size Scale Spec (`ui-space-size-scale-spec`) | per-project | Component inventory, platform targets, density goals | Spacing, sizing, icon-size, control-height, and container-width tokens |
| Shape and Elevation Token Spec (`ui-shape-elevation-token-spec`) | per-project | Surface taxonomy, theme needs, platform targets | Radius, border-width, border-style, shadow, and elevation tokens |
| Semantic Color Mapping Spec (`ui-semantic-color-map`) | per-project | Color tokens, product state taxonomy, accessibility policy | Semantic roles mapped to theme-safe tokens for status, emphasis, and action types |
| Theme Manifest (`ui-theme-manifest`) | per-project | Token specs, semantic color map, supported modes | Light, dark, and high-contrast theme bindings plus fallback rules |
| Breakpoint Registry Spec (`ui-breakpoint-registry`) | per-project | Target platforms, shell constraints, density goals | Canonical breakpoint, container, and viewport behavior registry |
| Asset Usage Rules (`ui-asset-usage-rules`) | per-project | Brand asset inventory, directionality rules, theme needs | Formal rules for iconography and illustration families, size, stroke, and mirroring |
| Visual Hierarchy Rules (`ui-visual-hierarchy-rules`) | per-project | Product priorities, typography scale, spacing scale, semantic color map | Structured priority ladder for page headings, actions, emphasis, and supporting detail |
| Locale and RTL Visual Constraint Spec (`ui-locale-rtl-visual-constraints`) | per-project | Locale list, i18n manifest, breakpoint registry, asset rules | Constraints for mirroring, text expansion, truncation, bidi safety, and locale exceptions |
| Visual Regression Baseline Spec (`ui-visual-regression-baseline`) | per-project | Component variants, page surfaces, themes, state appearance specs | Baseline snapshot manifest and acceptance thresholds for visual regression tooling |
| Visual Experiment Variant Spec (`ui-visual-experiment-variant-spec`) | per-experiment | Base UI specs, hypothesis, flag manifest, target surfaces | Control and treatment visual deltas mapped cleanly to experiment flags |

## Daily compiler tasks

### 1. Component Variant Spec (`ui-component-variant-spec`)

- **Name:** Component Variant Spec
- **Frequency:** daily
- **Input:** Approved component IDs, token system, theme manifest, UI requirements, and, when available, UX wireframe references
- **Output:** Component visual variants and slot-level visual contracts
- **Spec file:** `ui/components/<component-id>.variants.json`
  - Top-level keys: `component_id, slots, variants, token_refs, allowed_combinations, forbidden_combinations, surface_bindings`
- **Correctness gates:**
  - Every component ID must exist in the `react-component` manifest or be explicitly marked as pending.
  - Every token reference must resolve to an existing token in the color, typography, spacing, size, shape, or theme manifests.
  - Every declared variant combination must be unique and serializable into a deterministic variant key.
  - Every visual slot must have a defined token contract for all declared themes.
  - No raw color, pixel, radius, or shadow values may appear outside approved escape hatches.
- **Dependencies:** `ui-color-token-spec`, `ui-typography-scale-spec`, `ui-space-size-scale-spec`, `ui-shape-elevation-token-spec`, `ui-theme-manifest`, `react-component`
- **Downstream consumers:** `react-component`, `ui-component-state-appearance`, `ui-form-field-visual-rules`, `ui-handoff-annotation`, `ui-visual-regression-baseline`, `ui-design-system-drift-report`
- **Error codes:**
  - `UI101 Unknown component reference`
  - `UI102 Undefined token reference`
  - `UI103 Duplicate or conflicting variant combination`
- **Key invariant:** Fail if any component variant cannot be expressed entirely through approved tokens and a known component contract.
- **Safe default:** Fall back to a single `default` variant using neutral tokens and no optional slot overrides.

### 2. Component State Appearance Matrix (`ui-component-state-appearance`)

- **Name:** Component State Appearance Matrix
- **Frequency:** daily
- **Input:** Component variants, interaction-state requirements, semantic color map, and any state coverage coming from UX or page artifacts
- **Output:** Per-component appearance matrix for default, hover, focus, active, disabled, selected, loading, error, and success
- **Spec file:** `ui/components/<component-id>.states.json`
  - Top-level keys: `component_id, base_variant_refs, states, token_deltas, accessibility_overrides, theme_overrides`
- **Correctness gates:**
  - Every interactive component must cover `default`, `hover`, `focus`, `active`, and `disabled` unless explicitly non-interactive.
  - Every selectable component must cover `selected` or `checked` where the control contract supports it.
  - Every validation-capable or status-aware component must map `error` and `success` states to semantic roles from `ui-semantic-color-map`.
  - Focus appearance must pass a policy hook compatible with `a11y-test` when that manifest exists.
  - No state token delta may reference an undefined base variant or undefined theme mode.
- **Dependencies:** `ui-component-variant-spec`, `ui-semantic-color-map`, `ui-theme-manifest`, `react-component`
- **Downstream consumers:** `react-component`, `ui-form-field-visual-rules`, `ui-feedback-visual-pattern-spec`, `ui-overlay-presentation-spec`, `ui-visual-regression-baseline`
- **Error codes:**
  - `UI104 Required interaction state missing`
  - `UI105 Illegal state-to-token mapping`
  - `UI106 Focus appearance contract missing`
- **Key invariant:** Fail if a supported component state can occur at runtime without a defined appearance contract.
- **Safe default:** Inherit the base variant and apply only minimal semantic deltas for disabled, focus, and error.

### 3. Form Field Visual Rules (`ui-form-field-visual-rules`)

- **Name:** Form Field Visual Rules
- **Frequency:** daily
- **Input:** Form control manifest, component variants, validation states, theme manifest, and locale constraints
- **Output:** Visual rules for text inputs, selects, checkboxes, radios, toggles, textareas, helpers, and validation surfaces
- **Spec file:** `ui/forms/<form-family>.field-rules.json`
  - Top-level keys: `control_types, size_tiers, slot_bindings, validation_appearances, helper_patterns, density_modes, theme_overrides`
- **Correctness gates:**
  - Every control type used in the `react-form` manifest must map to a supported visual family.
  - Every validation state exposed by `react-form` must map to a defined appearance and message slot.
  - Label, helper, placeholder, counter, and error regions must each have explicit typographic and spacing contracts.
  - Disabled and read-only states must be visually distinct and not collapse into the same token set unless explicitly allowed.
  - Long-label and localized-string overflow policy must be declared for every field family.
- **Dependencies:** `ui-component-variant-spec`, `ui-component-state-appearance`, `ui-theme-manifest`, `ui-locale-rtl-visual-constraints`, `react-form`
- **Downstream consumers:** `react-form`, `react-page`, `ui-handoff-annotation`, `ui-visual-regression-baseline`, `ui-design-system-drift-report`
- **Error codes:**
  - `UI107 Unsupported form control family`
  - `UI108 Validation state appearance missing`
  - `UI109 Label or helper overflow policy undefined`
- **Key invariant:** Fail if any shipped form control can validate, disable, or localize without a defined visual contract.
- **Safe default:** Use a neutral single-column field family with inline error text below the control.

### 4. Handoff Annotation Spec (`ui-handoff-annotation`)

- **Name:** Handoff Annotation Spec
- **Frequency:** daily
- **Input:** Wireframes, component variants, responsive layout, motion spec, and page or feature scope
- **Output:** Structured implementation notes tied to exact surfaces, slots, and states
- **Spec file:** `ui/handoff/<feature>.annotations.json`
  - Top-level keys: `targets, annotations, source_refs, implementation_notes, state_refs, motion_refs, qa_notes`
- **Correctness gates:**
  - Every annotation target must resolve to a known page region, component slot, or state node.
  - Every annotation must be typed as `layout`, `state`, `token`, `asset`, `motion`, or `interaction-surface`.
  - Free-text annotations without target IDs are forbidden.
  - Every non-default behavior note must reference the upstream spec that owns the rule.
  - Conflicting annotations on the same target and same mode must be rejected.
- **Dependencies:** `ui-component-variant-spec`, `ui-responsive-layout-spec`, `ui-motion-spec`, and, when present, `ux-wireframe-manifest`
- **Downstream consumers:** `react-component`, `react-page`, `react-form`, `ui-design-system-drift-report`
- **Error codes:**
  - `UI110 Annotation target missing`
  - `UI111 Untyped or free-floating annotation`
  - `UI112 Conflicting annotations on same target`
- **Key invariant:** Fail if any handoff note cannot be attached to a stable machine-readable target.
- **Safe default:** Emit no annotations and rely only on upstream specs.

### 5. Design System Drift Report (`ui-design-system-drift-report`)

- **Name:** Design System Drift Report
- **Frequency:** daily
- **Input:** Shipped component and page manifests, token system, variant specs, form rules, and regression baselines
- **Output:** Pass or fail report for visual drift, unmanaged overrides, and token parity mismatches
- **Spec file:** `ui/reports/<scope>.drift-report.json`
  - Top-level keys: `scope, inspected_artifacts, token_mismatches, unmanaged_overrides, missing_variants, severity, blocking_failures`
- **Correctness gates:**
  - Every shipped component style hook must resolve back to a known variant, state appearance, or approved override.
  - Every shipped token usage must reference a defined token or approved alias.
  - Any page or component that bypasses the token system must be reported with severity.
  - Any shipped visual state not present in the state appearance matrix must be reported as blocking.
  - The report itself must classify every finding with severity and owning spec.
- **Dependencies:** `ui-component-variant-spec`, `ui-component-state-appearance`, `ui-form-field-visual-rules`, `ui-visual-regression-baseline`, `react-component`, `react-form`, `react-page`
- **Downstream consumers:** release gating, `react-component`, `react-form`, `react-page`, `ui-visual-experiment-variant-spec`
- **Error codes:**
  - `UI113 Unmanaged visual override detected`
  - `UI114 Shipped variant missing spec coverage`
  - `UI115 Token parity mismatch`
- **Key invariant:** Fail if shipped UI contains unmanaged visual behavior outside the formal token and variant system.
- **Safe default:** Block only unmanaged raw values and warn on missing metadata until stricter coverage is available.

## Per-feature compiler tasks

### 6. Responsive Layout Spec (`ui-responsive-layout-spec`)

- **Name:** Responsive Layout Spec
- **Frequency:** per-feature
- **Input:** Page surfaces, breakpoint registry, visual hierarchy rules, locale constraints, and screen structure
- **Output:** Breakpoint-aware layout behavior for each screen or surface
- **Spec file:** `ui/layout/<feature>.responsive.json`
  - Top-level keys: `feature_id, surfaces, breakpoint_behaviors, region_order, visibility_rules, overflow_policies, shell_bindings`
- **Correctness gates:**
  - Every page surface from `react-page` must declare behavior for every breakpoint it claims to support.
  - Every region order must be deterministic per breakpoint and per direction mode.
  - Hidden, collapsed, or disclosed regions must define the target disclosure container.
  - Long localized strings and RTL mirroring must have explicit overflow or wrap rules where the layout can be affected.
  - Any layout using breakpoint IDs not present in `ui-breakpoint-registry` must fail.
- **Dependencies:** `ui-breakpoint-registry`, `ui-visual-hierarchy-rules`, `ui-locale-rtl-visual-constraints`, `react-page`
- **Downstream consumers:** `react-page`, `ui-grid-layout-spec`, `ui-overlay-presentation-spec`, `ui-dashboard-layout-density-spec`, `ui-handoff-annotation`, `ui-visual-regression-baseline`
- **Error codes:**
  - `UI201 Undefined breakpoint behavior`
  - `UI202 Layout overflow policy missing`
  - `UI203 Route shell or surface mismatch`
- **Key invariant:** Fail if any declared breakpoint can render a page surface without a complete layout rule set.
- **Safe default:** Use a single-column stacked layout below the first breakpoint and preserve desktop order above it.

### 7. Grid Layout Spec (`ui-grid-layout-spec`)

- **Name:** Grid Layout Spec
- **Frequency:** per-feature
- **Input:** Responsive layout requirements, breakpoint registry, page regions, and density goals
- **Output:** Formal grid, column, gutter, span, and region alignment rules
- **Spec file:** `ui/layout/<feature>.grid.json`
  - Top-level keys: `feature_id, grids, columns, gutters, margins, region_spans, alignment_rules, breakpoint_overrides`
- **Correctness gates:**
  - Every surface in the responsive layout spec must bind to exactly one grid per breakpoint.
  - Region span totals may not exceed available column counts.
  - Grid margins and gutters must resolve to approved spacing tokens only.
  - Sticky or fixed regions must declare occupied space and collision behavior with other regions.
  - Density modes may not silently change the column count without an explicit override.
- **Dependencies:** `ui-space-size-scale-spec`, `ui-breakpoint-registry`, `ui-responsive-layout-spec`, `react-page`
- **Downstream consumers:** `react-page`, `ui-skeleton-loading-spec`, `ui-dashboard-layout-density-spec`, `ui-visual-regression-baseline`
- **Error codes:**
  - `UI204 Invalid region span or column overflow`
  - `UI205 Breakpoint grid definition incomplete`
  - `UI206 Density mode conflicts with grid contract`
- **Key invariant:** Fail if any region cannot be placed on a valid grid across all supported breakpoints.
- **Safe default:** Use a 12-column desktop grid and 4-column mobile grid with standard gutters.

### 8. Skeleton Loading Spec (`ui-skeleton-loading-spec`)

- **Name:** Skeleton Loading Spec
- **Frequency:** per-feature
- **Input:** Async regions, state matrix, grid layout, theme manifest, and component variants
- **Output:** Skeleton structures, sizes, shimmer policy, and terminal handoff rules
- **Spec file:** `ui/states/<feature>.skeletons.json`
  - Top-level keys: `feature_id, surfaces, async_regions, skeleton_blocks, dimensions, animation_policy, transition_targets`
- **Correctness gates:**
  - Every async region that uses skeletons must map each placeholder block to an eventual content region.
  - Skeleton dimensions must fit the bound grid and size tokens within tolerance.
  - Any motion used by skeletons must comply with `ui-motion-spec` reduced-motion overrides.
  - Every skeleton state must declare its terminal target state, such as loaded, empty, or error.
  - No skeleton may imply content structure that the loaded state does not support.
- **Dependencies:** `ui-grid-layout-spec`, `ui-theme-manifest`, `ui-motion-spec`, `ui-component-variant-spec`, and, when present, `ux-state-matrix`
- **Downstream consumers:** `react-page`, `ui-feedback-visual-pattern-spec`, `ui-visual-regression-baseline`
- **Error codes:**
  - `UI207 Async region missing skeleton coverage`
  - `UI208 Skeleton size or grid mismatch`
  - `UI209 Skeleton terminal handoff undefined`
- **Key invariant:** Fail if a skeleton can render without a deterministic mapping to a real loading surface and terminal outcome.
- **Safe default:** Use static neutral blocks without shimmer and replace them with loaded content when available.

### 9. Feedback Visual Pattern Spec (`ui-feedback-visual-pattern-spec`)

- **Name:** Feedback Visual Pattern Spec
- **Frequency:** per-feature
- **Input:** State matrix, semantic color map, copy structure, component variants, and page surfaces
- **Output:** Visual patterns for empty, error, success, offline, partial, and not-found states
- **Spec file:** `ui/states/<feature>.feedback-patterns.json`
  - Top-level keys: `feature_id, state_types, surface_patterns, icon_rules, action_slots, semantic_bindings, density_overrides`
- **Correctness gates:**
  - Every required state from the state matrix must bind to a supported visual pattern or explicit inheritance rule.
  - Every state pattern must define at least one action slot or explicitly state that no action is available.
  - Semantic roles for destructive, warning, success, and informational states must resolve through `ui-semantic-color-map`.
  - Empty and no-data states must be visually distinct from error states.
  - Offline and partial-data states must define stale-data emphasis and recovery emphasis separately.
- **Dependencies:** `ui-semantic-color-map`, `ui-component-variant-spec`, `ui-component-state-appearance`, `ui-theme-manifest`, and, when present, `ux-state-matrix`, `ux-copy-structure`
- **Downstream consumers:** `react-page`, `ui-destructive-action-visual-spec`, `ui-visual-regression-baseline`, `ui-design-system-drift-report`
- **Error codes:**
  - `UI210 Required feedback state visual missing`
  - `UI211 Semantic mapping conflicts with state type`
  - `UI212 Action hierarchy undefined for feedback state`
- **Key invariant:** Fail if any runtime state can appear without a distinct and semantically correct visual fallback.
- **Safe default:** Use neutral iconless cards for empty and error states with a single primary action slot.

### 10. Overlay Presentation Spec (`ui-overlay-presentation-spec`)

- **Name:** Overlay Presentation Spec
- **Frequency:** per-feature
- **Input:** Page shells, component variants, motion spec, responsive layout, and destructive action rules where relevant
- **Output:** Visual rules for modal, drawer, popover, sheet, toast, and layered surfaces
- **Spec file:** `ui/overlays/<feature>.overlays.json`
  - Top-level keys: `feature_id, overlay_types, shells, sizes, elevations, backdrop_rules, entry_exit_motion, stacking_rules`
- **Correctness gates:**
  - Every overlay type must declare container size tiers, surface styling, and z-order class.
  - Any overlay with user action controls must inherit a focus-visible treatment from component state specs.
  - Dismissal affordance placement must be declared for each supported breakpoint.
  - Overlay stacking rules must prevent two overlays from claiming the same stack level without arbitration.
  - Drawer and sheet behavior must define breakpoint transitions to modal or inline presentations where applicable.
- **Dependencies:** `ui-shape-elevation-token-spec`, `ui-component-variant-spec`, `ui-component-state-appearance`, `ui-motion-spec`, `ui-responsive-layout-spec`
- **Downstream consumers:** `react-page`, `react-component`, `ui-destructive-action-visual-spec`, `ui-visual-regression-baseline`
- **Error codes:**
  - `UI213 Overlay focus container missing`
  - `UI214 Overlay stack conflict`
  - `UI215 Overlay dismissal rule undefined`
- **Key invariant:** Fail if any overlay can be rendered without a deterministic container, stack level, and dismissal presentation.
- **Safe default:** Use a centered modal with standard elevation and explicit close action.

### 11. Data Table Visual Spec (`ui-data-table-visual-spec`)

- **Name:** Data Table Visual Spec
- **Frequency:** per-feature
- **Input:** Data schema, row actions, density rules, component variants, responsive layout, and locale constraints
- **Output:** Table styling, density modes, sticky regions, row states, and overflow behavior
- **Spec file:** `ui/data/<feature>.table.json`
  - Top-level keys: `feature_id, table_id, columns, header_rules, row_states, density_modes, sticky_regions, overflow_rules, mobile_transform`
- **Correctness gates:**
  - Every visible column must have priority, truncation, alignment, and minimum width rules.
  - Every row state such as selected, hovered, disabled, expanded, loading, and error must map to a defined appearance.
  - Sticky header, sticky column, and horizontal overflow behavior must be explicit.
  - Bulk-select controls and row-action controls must reference known component variants.
  - Mobile transformation rules must exist when the page supports breakpoints below the minimum dense table threshold.
- **Dependencies:** `ui-component-variant-spec`, `ui-component-state-appearance`, `ui-responsive-layout-spec`, `ui-locale-rtl-visual-constraints`, `react-page`
- **Downstream consumers:** `react-page`, `react-component`, `ui-dashboard-layout-density-spec`, `ui-visual-regression-baseline`, `ui-design-system-drift-report`
- **Error codes:**
  - `UI216 Column priority or truncation rule missing`
  - `UI217 Dense table breakpoint strategy missing`
  - `UI218 Row state appearance missing`
- **Key invariant:** Fail if a table can enter a supported density or row state without a defined visual contract.
- **Safe default:** Use medium density, non-sticky rows, and a stacked mobile fallback.

### 12. Dashboard Layout Density Spec (`ui-dashboard-layout-density-spec`)

- **Name:** Dashboard Layout Density Spec
- **Frequency:** per-feature
- **Input:** Dashboard hierarchy, metric modules, grid layout, breakpoint registry, and visual hierarchy rules
- **Output:** Visual hierarchy and density rules for dashboards and other data-dense surfaces
- **Spec file:** `ui/data/<feature>.dashboard-density.json`
  - Top-level keys: `feature_id, modules, priority_groups, density_modes, layout_regions, breakpoint_rules, fallback_regions`
- **Correctness gates:**
  - Every module must have a declared priority tier and a fallback behavior for smaller breakpoints.
  - Every density mode must define spacing, module compression, and disclosure rules using approved tokens.
  - Summary modules and drill-down modules may not compete for the same priority slot at the same breakpoint without an explicit tie-break rule.
  - Partial-data and stale-data indicators must have reserved visual space in every density mode.
  - The spec must define the maximum simultaneous emphasis count per dashboard surface.
- **Dependencies:** `ui-grid-layout-spec`, `ui-visual-hierarchy-rules`, `ui-space-size-scale-spec`, `ui-data-viz-style-spec` when charts are present, and, when present, `ux-dashboard-hierarchy`
- **Downstream consumers:** `react-page`, `ui-data-viz-style-spec`, `ui-visual-regression-baseline`
- **Error codes:**
  - `UI219 Module priority conflict unresolved`
  - `UI220 Density mode missing breakpoint fallback`
  - `UI221 Partial-data space reservation missing`
- **Key invariant:** Fail if a dashboard can compress, expand, or lose data density without a deterministic priority and fallback model.
- **Safe default:** Show only priority-one modules on small screens and stack the rest below the fold.

### 13. Data Visualization Style Spec (`ui-data-viz-style-spec`)

- **Name:** Data Visualization Style Spec
- **Frequency:** per-feature
- **Input:** Chart inventory, semantic color map, typography scale, theme manifest, and dashboard or page context
- **Output:** Style rules for charts, legends, axes, gridlines, empty states, and no-data surfaces
- **Spec file:** `ui/data/<feature>.dataviz.json`
  - Top-level keys: `feature_id, charts, palettes, role_bindings, axis_styles, legend_rules, annotation_rules, no_data_patterns`
- **Correctness gates:**
  - Every chart series role must bind to a palette slot that exists for every supported theme.
  - Axis, legend, label, and tooltip typography must resolve to existing type tokens.
  - Minimum contrast policy must pass for gridlines, labels, and highlighted series in every supported theme.
  - Charts must define no-data, partial-data, and loading presentation when the surface can encounter those states.
  - Chart color usage may not conflict with reserved semantic roles such as destructive or success unless explicitly allowed.
- **Dependencies:** `ui-color-token-spec`, `ui-typography-scale-spec`, `ui-semantic-color-map`, `ui-theme-manifest`, and, when present, `ux-state-matrix`
- **Downstream consumers:** `react-page`, `ui-dashboard-layout-density-spec`, `ui-visual-regression-baseline`
- **Error codes:**
  - `UI222 Chart series role mapping invalid`
  - `UI223 Theme contrast failure in chart styling`
  - `UI224 No-data or partial-data visualization missing`
- **Key invariant:** Fail if a chart can render a supported data state or theme without a complete and contrast-safe style contract.
- **Safe default:** Use a minimal categorical palette, neutral axes, and a standard no-data card below the chart title.

### 14. Motion Spec (`ui-motion-spec`)

- **Name:** Motion Spec
- **Frequency:** per-feature
- **Input:** Component variants, overlays, page transitions, state changes, and accessibility policy
- **Output:** Motion tokens, timing, easing, entry or exit rules, and reduced-motion overrides
- **Spec file:** `ui/motion/<feature>.motion.json`
  - Top-level keys: `feature_id, motion_tokens, surfaces, transitions, trigger_rules, reduced_motion_overrides, disallowed_motion`
- **Correctness gates:**
  - Every motion reference must resolve to a defined duration and easing token.
  - Every motion-capable surface must declare a reduced-motion override or explicit no-motion fallback.
  - Motion may not be attached to blocking failure surfaces unless explicitly allowed by policy.
  - Entry and exit motion for overlays must align with overlay presentation types.
  - Auto-running infinite motion is forbidden unless marked decorative and suppressible.
- **Dependencies:** `ui-space-size-scale-spec`, `ui-component-variant-spec`, and, when available, `a11y-test`
- **Downstream consumers:** `react-page`, `react-component`, `ui-skeleton-loading-spec`, `ui-overlay-presentation-spec`, `ui-visual-regression-baseline`
- **Error codes:**
  - `UI225 Reduced-motion override missing`
  - `UI226 Invalid motion token reference`
  - `UI227 Motion attached to disallowed path`
- **Key invariant:** Fail if any declared motion can run without a compliant reduced-motion fallback.
- **Safe default:** Disable all non-essential motion and keep only instant state changes.

### 15. Destructive Action Visual Spec (`ui-destructive-action-visual-spec`)

- **Name:** Destructive Action Visual Spec
- **Frequency:** per-feature
- **Input:** Permission rules, state matrix, semantic color map, overlay rules, and relevant task or form surfaces
- **Output:** Visual contracts for destructive confirmations, undo surfaces, and irreversible states
- **Spec file:** `ui/states/<feature>.destructive-actions.json`
  - Top-level keys: `feature_id, actions, severity_tiers, confirmation_surfaces, undo_patterns, irreversible_states, semantic_bindings`
- **Correctness gates:**
  - Every destructive action must be assigned a severity tier and presentation surface.
  - Reversible and irreversible destructive actions must not share the same confirmation contract unless explicitly approved.
  - Destructive emphasis must bind to reserved semantic roles from `ui-semantic-color-map`.
  - If undo is supported, the post-action feedback surface must be declared with its timeout or persistence rule.
  - Disabled, unavailable, and unauthorized destructive triggers must each have distinct presentation rules.
- **Dependencies:** `ui-semantic-color-map`, `ui-overlay-presentation-spec`, `ui-feedback-visual-pattern-spec`, `ui-component-state-appearance`, and, when present, `ux-destructive-action`, `auth-middleware`
- **Downstream consumers:** `react-page`, `react-component`, `ui-visual-regression-baseline`, `ui-design-system-drift-report`
- **Error codes:**
  - `UI228 Destructive emphasis mapping invalid`
  - `UI229 Confirmation or undo presentation missing`
  - `UI230 Irreversible action contract ambiguous`
- **Key invariant:** Fail if a destructive action can be rendered without a severity-safe and semantically reserved presentation.
- **Safe default:** Use a high-emphasis confirmation modal with one destructive action and one cancel action.

## Per-project compiler tasks

### 16. Color Token Spec (`ui-color-token-spec`)

- **Name:** Color Token Spec
- **Frequency:** per-project
- **Input:** Brand constraints, accessibility policy, semantic role candidates, and supported theme count
- **Output:** Raw and alias color tokens with metadata and allowed usage
- **Spec file:** `ui/tokens/color.tokens.json`
  - Top-level keys: `raw_tokens, alias_tokens, usage_metadata, contrast_pairs, reserved_roles, deprecations`
- **Correctness gates:**
  - Every alias token must resolve to a raw token or another alias without circular references.
  - No duplicate token IDs or duplicate semantic names may exist.
  - Every color token used in semantic mappings or themes must include contrast metadata against at least one background class.
  - Raw hex or color values are forbidden outside the token registry.
  - Deprecated tokens must list an approved replacement.
- **Dependencies:** none
- **Downstream consumers:** `ui-semantic-color-map`, `ui-theme-manifest`, `ui-component-variant-spec`, `ui-data-viz-style-spec`, `ui-design-system-drift-report`
- **Error codes:**
  - `UI301 Duplicate or circular color token`
  - `UI302 Raw color value found outside registry`
  - `UI303 Contrast metadata missing`
- **Key invariant:** Fail if any project color used by downstream UI artifacts is not defined as a resolvable token with metadata.
- **Safe default:** Provide a minimal neutral palette plus one accent scale and one destructive scale.

### 17. Typography Scale Spec (`ui-typography-scale-spec`)

- **Name:** Typography Scale Spec
- **Frequency:** per-project
- **Input:** Brand text constraints, platform targets, localization constraints, and density goals
- **Output:** Type tokens, line-height pairs, tracking, casing policy, and text role mapping
- **Spec file:** `ui/tokens/typography.tokens.json`
  - Top-level keys: `font_families, text_styles, line_height_pairs, tracking_rules, text_roles, locale_overrides`
- **Correctness gates:**
  - Every text style token must define font family, size, line-height, and weight.
  - Every text role must map to exactly one default style token.
  - Any casing transformation policy must declare locale exceptions where casing is unsafe.
  - Every style used in a compact or dense mode must meet a minimum line-height rule.
  - Expansion budget metadata must exist for primary navigation, form labels, buttons, and table headers.
- **Dependencies:** none
- **Downstream consumers:** `ui-component-variant-spec`, `ui-form-field-visual-rules`, `ui-data-viz-style-spec`, `ui-visual-hierarchy-rules`, `ui-locale-rtl-visual-constraints`
- **Error codes:**
  - `UI304 Incomplete text style token`
  - `UI305 Invalid size and line-height pairing`
  - `UI306 Locale expansion budget missing`
- **Key invariant:** Fail if any downstream text role resolves to an incomplete or locale-unsafe type style.
- **Safe default:** Use a small text role set: display, heading, body, label, caption, and code.

### 18. Space and Size Scale Spec (`ui-space-size-scale-spec`)

- **Name:** Space and Size Scale Spec
- **Frequency:** per-project
- **Input:** Component inventory, platform targets, density goals, and icon needs
- **Output:** Spacing, sizing, icon-size, control-height, and container-width tokens
- **Spec file:** `ui/tokens/space-size.tokens.json`
  - Top-level keys: `space_tokens, size_tokens, control_heights, icon_sizes, container_widths, density_overrides`
- **Correctness gates:**
  - Spacing and size scales must be monotonic within each family.
  - Alias tokens may not form cycles.
  - Every declared control size tier used by components or forms must map to a valid height token.
  - Density overrides must reference only declared base tokens.
  - Container widths and max-widths must reference registered breakpoints where required.
- **Dependencies:** none
- **Downstream consumers:** `ui-component-variant-spec`, `ui-grid-layout-spec`, `ui-motion-spec`, `ui-dashboard-layout-density-spec`, `ui-visual-hierarchy-rules`
- **Error codes:**
  - `UI307 Non-monotonic or cyclical scale`
  - `UI308 Alias cycle or unresolved size token`
  - `UI309 Control or icon size tier unmapped`
- **Key invariant:** Fail if any spacing or size token family cannot be resolved into a coherent scale used by downstream artifacts.
- **Safe default:** Use a standard 4-point spacing family and three control height tiers.

### 19. Shape and Elevation Token Spec (`ui-shape-elevation-token-spec`)

- **Name:** Shape and Elevation Token Spec
- **Frequency:** per-project
- **Input:** Surface taxonomy, theme needs, platform targets, and overlay depth requirements
- **Output:** Radius, border-width, border-style, shadow, and elevation tokens
- **Spec file:** `ui/tokens/shape-elevation.tokens.json`
  - Top-level keys: `radius_tokens, border_tokens, shadow_tokens, elevation_levels, theme_overrides, surface_bindings`
- **Correctness gates:**
  - Every elevation level must bind to a shadow token or explicit no-shadow rule per theme.
  - Radius tokens must be finite, named, and monotonic within each family.
  - Border tokens must define width, style, and eligible semantic use.
  - Surface bindings may not reference undefined elevation or shape tokens.
  - Overlay elevations must be higher than base content elevations in the registry.
- **Dependencies:** none
- **Downstream consumers:** `ui-theme-manifest`, `ui-component-variant-spec`, `ui-overlay-presentation-spec`, `ui-visual-regression-baseline`
- **Error codes:**
  - `UI310 Elevation level missing theme binding`
  - `UI311 Undefined border or radius token`
  - `UI312 Surface binding conflicts with depth order`
- **Key invariant:** Fail if any surface depth or shape rule cannot be resolved across all declared themes.
- **Safe default:** Provide four radius tiers, two border tiers, and four elevation levels including a flat level.

### 20. Semantic Color Mapping Spec (`ui-semantic-color-map`)

- **Name:** Semantic Color Mapping Spec
- **Frequency:** per-project
- **Input:** Color tokens, product state taxonomy, action taxonomy, and accessibility policy
- **Output:** Semantic roles mapped to theme-safe tokens for status, emphasis, and action types
- **Spec file:** `ui/tokens/semantic-color-map.json`
  - Top-level keys: `roles, state_bindings, action_bindings, theme_bindings, emphasis_tiers, forbidden_mappings`
- **Correctness gates:**
  - Every required semantic role such as primary, secondary, info, success, warning, destructive, disabled, focus, and selected must be mapped.
  - Each semantic role must resolve to a token available in every supported theme mode.
  - Forbidden role collisions such as success and destructive sharing the same semantic token set in one theme must fail unless explicitly waived.
  - Text-on-surface roles must declare compatible background classes.
  - Component and feedback specs may not reference raw color tokens directly when a semantic role exists.
- **Dependencies:** `ui-color-token-spec`
- **Downstream consumers:** `ui-theme-manifest`, `ui-component-state-appearance`, `ui-feedback-visual-pattern-spec`, `ui-data-viz-style-spec`, `ui-destructive-action-visual-spec`
- **Error codes:**
  - `UI313 Required semantic role unmapped`
  - `UI314 Semantic role conflicts across themes`
  - `UI315 Forbidden semantic collision detected`
- **Key invariant:** Fail if a required product state or action semantic cannot resolve to a theme-safe token contract.
- **Safe default:** Provide a minimal semantic map for primary, muted, info, success, warning, destructive, disabled, and focus.

### 21. Theme Manifest (`ui-theme-manifest`)

- **Name:** Theme Manifest
- **Frequency:** per-project
- **Input:** Token specs, semantic color map, supported modes, and theme policy
- **Output:** Light, dark, and high-contrast theme bindings plus fallback rules
- **Spec file:** `ui/themes/themes.manifest.json`
  - Top-level keys: `themes, modes, token_bindings, semantic_bindings, fallback_rules, inheritance, deprecations`
- **Correctness gates:**
  - Every supported mode must include complete bindings for all required token families.
  - All aliases must resolve without cycles inside each theme mode.
  - High-contrast mode must declare explicit overrides where contrast requirements differ from standard modes.
  - Every semantic role from `ui-semantic-color-map` must bind to a valid token in every supported theme.
  - Fallback rules must define what happens when a token is missing in a non-default mode.
- **Dependencies:** `ui-color-token-spec`, `ui-shape-elevation-token-spec`, `ui-semantic-color-map`
- **Downstream consumers:** all component, layout, state, and regression compilers
- **Error codes:**
  - `UI316 Theme mode incomplete`
  - `UI317 Unresolved token alias in theme`
  - `UI318 High-contrast override incomplete`
- **Key invariant:** Fail if any supported mode can be selected without a complete token and semantic binding set.
- **Safe default:** Provide one light theme as default and derive dark mode only when a full map exists.

### 22. Breakpoint Registry Spec (`ui-breakpoint-registry`)

- **Name:** Breakpoint Registry Spec
- **Frequency:** per-project
- **Input:** Target platforms, shell constraints, density goals, and container strategy
- **Output:** Canonical breakpoint, container, and viewport behavior registry
- **Spec file:** `ui/layout/breakpoints.json`
  - Top-level keys: `breakpoints, containers, viewport_classes, shell_constraints, density_thresholds, deprecations`
- **Correctness gates:**
  - Breakpoint ranges may not overlap.
  - Every named breakpoint must define a min or max boundary and container rule.
  - Container classes must map to approved width tokens where applicable.
  - Density thresholds for tables or dashboards must reference existing breakpoint IDs.
  - Any page manifest referencing a breakpoint not in the registry must fail downstream parity checks.
- **Dependencies:** `ui-space-size-scale-spec`
- **Downstream consumers:** `ui-responsive-layout-spec`, `ui-grid-layout-spec`, `ui-data-table-visual-spec`, `ui-dashboard-layout-density-spec`, `ui-locale-rtl-visual-constraints`
- **Error codes:**
  - `UI319 Overlapping breakpoint ranges`
  - `UI320 Breakpoint referenced but undefined`
  - `UI321 Container constraint missing`
- **Key invariant:** Fail if the project defines viewport classes that cannot be deterministically resolved by downstream layout specs.
- **Safe default:** Provide mobile, tablet, desktop, and wide-desktop classes with simple container widths.

### 23. Asset Usage Rules (`ui-asset-usage-rules`)

- **Name:** Asset Usage Rules
- **Frequency:** per-project
- **Input:** Brand asset inventory, directionality rules, theme needs, and allowed visual families
- **Output:** Formal rules for iconography and illustration families, size, stroke, and mirroring
- **Spec file:** `ui/assets/asset-usage.json`
  - Top-level keys: `icon_families, illustration_families, stroke_rules, fill_rules, directionality_rules, theme_compatibility, forbidden_mixes`
- **Correctness gates:**
  - Every icon family must define stroke or fill behavior, sizing tiers, and semantic eligibility.
  - Direction-sensitive icons must declare RTL mirroring or non-mirroring rules.
  - Illustration families may not mix incompatible stroke, shading, or corner systems within the same surface class.
  - Dark and light theme compatibility must be declared for every asset family.
  - Decorative assets must be distinguishable from semantic status assets.
- **Dependencies:** `ui-color-token-spec`, `ui-space-size-scale-spec`, `ui-theme-manifest`
- **Downstream consumers:** `ui-feedback-visual-pattern-spec`, `ui-component-variant-spec`, `ui-handoff-annotation`, `ui-visual-regression-baseline`
- **Error codes:**
  - `UI322 Directionality rule missing for asset`
  - `UI323 Incompatible asset families mixed`
  - `UI324 Asset semantic eligibility undefined`
- **Key invariant:** Fail if an icon or illustration can appear without a declared family, size tier, and directionality policy.
- **Safe default:** Allow one icon family and no illustrations except feedback placeholders.

### 24. Visual Hierarchy Rules (`ui-visual-hierarchy-rules`)

- **Name:** Visual Hierarchy Rules
- **Frequency:** per-project
- **Input:** Product priorities, typography scale, spacing scale, semantic color map, and shell model
- **Output:** Structured priority ladder for page headings, actions, emphasis, and supporting detail
- **Spec file:** `ui/policy/visual-hierarchy.json`
  - Top-level keys: `priority_levels, heading_roles, action_emphasis, supporting_text_rules, density_overrides, surface_exceptions`
- **Correctness gates:**
  - Every priority level must map to a type role, spacing treatment, and action emphasis tier.
  - The spec must define how many primary actions may exist per surface class.
  - Heading roles may not skip required levels inside the same surface class without an exception rule.
  - Supporting text, helper text, and metadata roles must each map to specific type tokens.
  - The hierarchy rules must reference only approved typography, spacing, and semantic tokens.
- **Dependencies:** `ui-typography-scale-spec`, `ui-space-size-scale-spec`, `ui-semantic-color-map`
- **Downstream consumers:** `ui-responsive-layout-spec`, `ui-dashboard-layout-density-spec`, `ui-feedback-visual-pattern-spec`, `ui-data-viz-style-spec`
- **Error codes:**
  - `UI325 Priority ladder incomplete`
  - `UI326 Multiple primary emphasis slots exceed rule`
  - `UI327 Hierarchy rule references undefined token`
- **Key invariant:** Fail if a surface class can express emphasis without a deterministic priority ladder.
- **Safe default:** Allow one primary action, one secondary action group, and three text emphasis tiers per surface.

### 25. Locale and RTL Visual Constraint Spec (`ui-locale-rtl-visual-constraints`)

- **Name:** Locale and RTL Visual Constraint Spec
- **Frequency:** per-project
- **Input:** Locale list, i18n manifest, breakpoint registry, typography scale, asset rules, and shell constraints
- **Output:** Constraints for mirroring, text expansion, truncation, bidi safety, and locale exceptions
- **Spec file:** `ui/policy/locale-rtl-constraints.json`
  - Top-level keys: `locales, rtl_locales, expansion_budgets, mirroring_rules, truncation_rules, bidi_exceptions, asset_exceptions`
- **Correctness gates:**
  - Every supported locale must declare an expansion budget class or inherit one.
  - Every direction-sensitive surface class must declare mirroring behavior for RTL locales.
  - Truncation rules must specify which text roles may wrap, truncate, or scroll.
  - Any bidi-sensitive token or asset exception must list the exact target surface or component family.
  - Icon directionality rules must be consistent with `ui-asset-usage-rules`.
- **Dependencies:** `ui-typography-scale-spec`, `ui-breakpoint-registry`, `ui-asset-usage-rules`, `i18n`
- **Downstream consumers:** `ui-responsive-layout-spec`, `ui-form-field-visual-rules`, `ui-data-table-visual-spec`, `ui-handoff-annotation`, `ui-visual-regression-baseline`
- **Error codes:**
  - `UI328 RTL mirroring rule missing`
  - `UI329 Locale expansion budget insufficient or undefined`
  - `UI330 Bidi exception target invalid`
- **Key invariant:** Fail if a supported locale or direction mode can alter layout without an explicit constraint rule.
- **Safe default:** Allow wrapping for long labels, mirror row and column order, and keep numeric content left-to-right where applicable.

### 26. Visual Regression Baseline Spec (`ui-visual-regression-baseline`)

- **Name:** Visual Regression Baseline Spec
- **Frequency:** per-project
- **Input:** Component variants, page surfaces, themes, state appearance specs, responsive layouts, and overlay specs
- **Output:** Baseline snapshot manifest and acceptance thresholds for visual regression tooling
- **Spec file:** `ui/regression/baselines.json`
  - Top-level keys: `targets, states, themes, breakpoints, masks, tolerances, ownership, update_policy`
- **Correctness gates:**
  - Every target must reference a known component, state, or page surface with a stable ID.
  - Every critical component family must include at least one baseline per supported theme and at least one non-default state.
  - Dynamic regions must be masked or stabilized explicitly.
  - Acceptance thresholds must be defined for every baseline target class.
  - Breakpoints referenced in baselines must exist in `ui-breakpoint-registry`.
- **Dependencies:** `ui-component-variant-spec`, `ui-component-state-appearance`, `ui-responsive-layout-spec`, `ui-overlay-presentation-spec`, `ui-theme-manifest`, `ui-breakpoint-registry`
- **Downstream consumers:** regression tooling, `ui-design-system-drift-report`, release gating
- **Error codes:**
  - `UI331 Regression baseline target missing`
  - `UI332 Dynamic region not masked or stabilized`
  - `UI333 Acceptance threshold undefined`
- **Key invariant:** Fail if a critical surface cannot be regression-tested through a stable target, state, theme, and breakpoint tuple.
- **Safe default:** Baseline only default theme and default state for critical components until coverage expands.

## Per-experiment compiler tasks

### 27. Visual Experiment Variant Spec (`ui-visual-experiment-variant-spec`)

- **Name:** Visual Experiment Variant Spec
- **Frequency:** per-experiment
- **Input:** Base UI specs, hypothesis, flag manifest, target surfaces, and experiment guardrails
- **Output:** Control and treatment visual deltas mapped cleanly to experiment flags
- **Spec file:** `ui/experiments/<experiment-id>.visual-variants.json`
  - Top-level keys: `experiment_id, target_surfaces, control_refs, treatment_deltas, flag_bindings, guardrails, rollback_rules`
- **Correctness gates:**
  - Every experiment must bind to an existing `feature-flag` artifact or explicitly declare pending status.
  - Treatments may only override tokens, variants, layout rules, or asset rules that exist in the base spec set.
  - Control and treatment must preserve required state coverage, theme support, and locale support unless the experiment explicitly scopes them out.
  - Rollback rules must identify the exact base specs to restore.
  - Experiment deltas may not introduce raw values outside the token system.
- **Dependencies:** `feature-flag`, relevant base specs such as `ui-component-variant-spec`, `ui-responsive-layout-spec`, `ui-feedback-visual-pattern-spec`, `ui-theme-manifest`
- **Downstream consumers:** `react-component`, `react-page`, `ui-design-system-drift-report`, release gating
- **Error codes:**
  - `UI401 Experiment flag binding missing`
  - `UI402 Treatment delta references undefined base artifact`
  - `UI403 Control and treatment parity broken on required coverage`
- **Key invariant:** Fail if a treatment cannot be expressed as a bounded delta over known base UI specs and a valid runtime flag.
- **Safe default:** Do not render treatment. Serve the control experience only.

## Cross-compiler validation expectations

The UI compiler network should enforce the following cross-compiler checks wherever the relevant upstream artifacts exist:

1. `ui-component-variant-spec` must reference only component IDs that exist in `react-component` and only tokens that exist in the token and theme system.
2. `ui-form-field-visual-rules` must cover every form control family exposed by `react-form` and every validation state it can emit.
3. `ui-responsive-layout-spec` and `ui-grid-layout-spec` must define behavior for every breakpoint referenced by `react-page` surfaces in scope.
4. `ui-component-state-appearance`, `ui-skeleton-loading-spec`, and `ui-feedback-visual-pattern-spec` must cover the state classes required by page, query, or UX state artifacts.
5. `ui-motion-spec` must provide reduced-motion overrides and remain compatible with `a11y-test` policies when that manifest exists.
6. `ui-locale-rtl-visual-constraints`, `ui-typography-scale-spec`, and `ui-space-size-scale-spec` must tolerate i18n expansion and directionality requirements exposed by `i18n`.
7. `ui-visual-experiment-variant-spec` must map one-to-one to `feature-flag` artifacts and may not bypass base-spec coverage rules.
8. `ui-design-system-drift-report` should compare shipped page and component manifests against the formal UI spec graph and fail on unmanaged raw values or missing variant coverage.
9. `ui-visual-regression-baseline` should provide stable targets, masks, and tolerances for regression tooling and release gating.
10. `ui-destructive-action-visual-spec` should align with auth and permission outputs where destructive actions are role-gated.

## Recommended build order for the UI compiler network

The order below reflects dependency reality, not just task frequency. Daily compilers matter most in day-to-day production, but several of them depend on a minimal project foundation.

### Phase 0: core token and policy foundation

Build these first because almost everything else depends on them:

1. `ui-color-token-spec`
2. `ui-typography-scale-spec`
3. `ui-space-size-scale-spec`
4. `ui-shape-elevation-token-spec`
5. `ui-semantic-color-map`
6. `ui-theme-manifest`
7. `ui-breakpoint-registry`
8. `ui-asset-usage-rules`
9. `ui-visual-hierarchy-rules`
10. `ui-locale-rtl-visual-constraints`

### Phase 1: highest-leverage daily compilers

These unlock component-level delivery and handoff:

11. `ui-component-variant-spec`
12. `ui-component-state-appearance`
13. `ui-form-field-visual-rules`
14. `ui-handoff-annotation`

### Phase 2: page and feature surface compilers

These formalize full-screen and feature-level UI behavior:

15. `ui-responsive-layout-spec`
16. `ui-grid-layout-spec`
17. `ui-feedback-visual-pattern-spec`
18. `ui-motion-spec`
19. `ui-overlay-presentation-spec`
20. `ui-skeleton-loading-spec`
21. `ui-data-table-visual-spec`
22. `ui-dashboard-layout-density-spec`
23. `ui-data-viz-style-spec`
24. `ui-destructive-action-visual-spec`

### Phase 3: verification compilers

These make the system self-checking:

25. `ui-visual-regression-baseline`
26. `ui-design-system-drift-report`

### Phase 4: experiment compiler

Build this after the base system is stable:

27. `ui-visual-experiment-variant-spec`

## Minimal prerequisite graph

The smallest practical dependency chain is:

- `ui-color-token-spec` -> `ui-semantic-color-map` -> `ui-theme-manifest`
- `ui-typography-scale-spec` + `ui-space-size-scale-spec` + `ui-shape-elevation-token-spec` -> `ui-component-variant-spec`
- `ui-component-variant-spec` -> `ui-component-state-appearance` -> `ui-form-field-visual-rules`
- `ui-breakpoint-registry` + `ui-visual-hierarchy-rules` + `ui-locale-rtl-visual-constraints` -> `ui-responsive-layout-spec` -> `ui-grid-layout-spec`
- `ui-grid-layout-spec` + `ui-motion-spec` -> `ui-skeleton-loading-spec`
- `ui-semantic-color-map` + `ui-component-state-appearance` -> `ui-feedback-visual-pattern-spec`
- `ui-responsive-layout-spec` + `ui-motion-spec` + `ui-shape-elevation-token-spec` -> `ui-overlay-presentation-spec`
- `ui-component-variant-spec` + `ui-responsive-layout-spec` -> `ui-data-table-visual-spec`
- `ui-grid-layout-spec` + `ui-visual-hierarchy-rules` -> `ui-dashboard-layout-density-spec`
- `ui-theme-manifest` + `ui-component-variant-spec` + feature specs -> `ui-visual-regression-baseline` -> `ui-design-system-drift-report`
- stable base specs + `feature-flag` -> `ui-visual-experiment-variant-spec`

## Priority recommendation

If you want the shortest path to practical value, build this subset first:

1. `ui-color-token-spec`
2. `ui-typography-scale-spec`
3. `ui-space-size-scale-spec`
4. `ui-semantic-color-map`
5. `ui-theme-manifest`
6. `ui-component-variant-spec`
7. `ui-component-state-appearance`
8. `ui-form-field-visual-rules`
9. `ui-breakpoint-registry`
10. `ui-responsive-layout-spec`
11. `ui-feedback-visual-pattern-spec`
12. `ui-visual-regression-baseline`
13. `ui-design-system-drift-report`

That subset gives you a usable visual language, component contracts, state coverage, responsive behavior, and an enforcement loop. The rest can layer on top without changing the core model.
