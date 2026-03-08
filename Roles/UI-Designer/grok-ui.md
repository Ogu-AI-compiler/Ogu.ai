UI Designer Compiler Network
Overview
This document decomposes the UI designer role into atomic, repeatable task types suitable for implementation as compilers in a Domain Compiler Network. Each compiler takes an intent (spec) as input and produces a verified, attested artifact. The focus is on UI artifacts that define visual systems for digital products, treating UI as a formal visual system with machine-checkable outputs like token files, manifests, matrices, and reports.
Excluded are already-built compilers (e.g., react-component, react-page) and shared ones (e.g., utility-fn, feature-flag). Dependencies and downstream consumers reference these where relevant, including cross-compiler checks (e.g., token definitions must be referenced without errors in react-component artifacts).
The decomposition is exhaustive, covering core areas and edge cases like dark mode, high contrast mode, reduced motion mode, loading skeletons, empty/error states, dense data tables, mobile vs. desktop breakpoints, long localized strings, RTL mirroring, destructive actions, disabled/hover/focus/active/selected states, state explosion across variants, design system drift, mismatches between token systems and shipped components, experiment variants, and visual fallback states.
Tasks are prioritized by frequency: daily (few, if any), per-feature, per-project, per-experiment.
Summary Table

Task Name (Compiler ID)FrequencyInputOutputcolor-system-compilerper-projectColor palette requirementscolor_tokens.jsontypography-scale-compilerper-projectFont requirementstypography_tokens.jsonspacing-scale-compilerper-projectSpacing rulesspacing_tokens.jsonsizing-scale-compilerper-projectSizing rulessizing_tokens.jsonradius-border-shadow-compilerper-projectShape/elevation rulesshape_tokens.jsontheme-definition-compilerper-projectTheme mode specstheme_manifest.jsonresponsive-layout-compilerper-projectBreakpoint specsresponsive_layout.jsongrid-system-compilerper-projectGrid layout rulesgrid_system.jsoniconography-rules-compilerper-projectIcon set specsicon_rules.jsonillustration-rules-compilerper-projectIllustration guidelinesillustration_rules.jsonmotion-spec-compilerper-projectAnimation rulesmotion_manifest.jsonvisual-hierarchy-compilerper-projectHierarchy ruleshierarchy_rules.jsonsemantic-color-map-compilerper-projectEmphasis mappingssemantic_color_map.jsoncomponent-variant-compilerper-featureComponent intentcomponent_variants.jsonstate-appearance-compilerper-featureState specsstate_matrix.jsonskeleton-loading-compilerper-featureLoading patternsskeleton_specs.jsonerror-empty-success-compilerper-featureState patternsvisual_patterns.jsondata-dense-layout-compilerper-featureDense UI specsdense_layout.jsonform-field-visual-compilerper-featureForm rulesform_visual_rules.jsontable-styling-compilerper-featureTable rulestable_rules.jsonchart-vis-styling-compilerper-featureChart ruleschart_rules.jsonoverlay-presentation-compilerper-featureOverlay rulesoverlay_rules.jsonhandoff-annotation-compilerper-featureVisual intentvisual_annotations.jsonab-visual-variant-compilerper-experimentExperiment specsvisual_variants.jsonsystem-drift-report-compilerper-experimentToken and component artifactsdrift_report.jsontoken-mismatch-report-compilerper-experimentToken and implementation artifactsmismatch_report.json
Detailed Breakdown
color-system-compiler

Name: color-system-compiler
Frequency: per-project
Input: Color palette requirements, including semantic mappings.
Output: color_tokens.json – tokens for base colors, semantics.
Correctness gates: All tokens unique; contrast ratios meet WCAG (e.g., 4.5:1); no undefined references; covers dark/high contrast modes.
Dependencies: None (foundational).
Downstream consumers: theme-definition-compiler, semantic-color-map-compiler.
Spec file: color_system_spec.json – defines palettes and modes.
Error codes: UI001 (duplicate token), UI002 (low contrast), UI003 (mode missing), UI004 (undefined ref), UI005 (semantic gap).
Key invariant: Compiler fails if any color pair fails WCAG contrast check.
Safe default: Use neutral grayscale tokens only.

typography-scale-compiler

Name: typography-scale-compiler
Frequency: per-project
Input: Font requirements, scales.
Output: typography_tokens.json – font sizes, weights, lines.
Correctness gates: Scales modular (e.g., ratios 1.2+); readable sizes (min 12px); tolerates i18n expansion; cross-checks with i18n.
Dependencies: None.
Downstream consumers: visual-hierarchy-compiler.
Spec file: typography_scale_spec.json – lists fonts and scales.
Error codes: UI006 (non-modular scale), UI007 (small size), UI008 (no expansion tolerance), UI009 (weight missing), UI010 (i18n conflict).
Key invariant: Compiler fails if any scale step violates modularity ratio.
Safe default: System fonts with default browser sizes.

spacing-scale-compiler

Name: spacing-scale-compiler
Frequency: per-project
Input: Spacing rules.
Output: spacing_tokens.json – rem-based scales.
Correctness gates: Multiples of base (e.g., 4px); consistent across modes; RTL compatible.
Dependencies: None.
Downstream consumers: grid-system-compiler, responsive-layout-compiler.
Spec file: spacing_scale_spec.json – defines base and multiples.
Error codes: UI011 (inconsistent multiple), UI012 (px not rem), UI013 (RTL ignore), UI014 (mode variance), UI015 (zero spacing).
Key invariant: Compiler fails if spacings aren't multiples of base unit.
Safe default: Fixed 8px grid spacing.

sizing-scale-compiler

Name: sizing-scale-compiler
Frequency: per-project
Input: Sizing rules.
Output: sizing_tokens.json – widths, heights.
Correctness gates: Responsive-friendly (percent/em); no fixed pixels for fluid elements; covers breakpoints.
Dependencies: responsive-layout-compiler.
Downstream consumers: component-variant-compiler.
Spec file: sizing_scale_spec.json – lists sizes and units.
Error codes: UI016 (fixed px fluid), UI017 (breakpoint miss), UI018 (inconsistent unit), UI019 (oversize), UI020 (negative size).
Key invariant: Compiler fails if any fluid size uses fixed pixels.
Safe default: Auto-sizing based on content.

radius-border-shadow-compiler

Name: radius-border-shadow-compiler
Frequency: per-project
Input: Shape/elevation rules.
Output: shape_tokens.json – radii, borders, shadows.
Correctness gates: Consistent scales; shadows meet elevation logic; no excessive blur.
Dependencies: spacing-scale-compiler.
Downstream consumers: component-variant-compiler.
Spec file: radius_border_shadow_spec.json – defines values.
Error codes: UI021 (inconsistent radius), UI022 (blur excess), UI023 (elevation logic fail), UI024 (border miss), UI025 (shadow undefined).
Key invariant: Compiler fails if shadows don't align with elevation steps.
Safe default: Zero radius/border/shadow.

theme-definition-compiler

Name: theme-definition-compiler
Frequency: per-project
Input: Theme mode specs, including dark/light/high contrast.
Output: theme_manifest.json – mappings per mode.
Correctness gates: All tokens mapped per mode; no missing modes; cross-checks with a11y-test (contrast passes).
Dependencies: color-system-compiler, typography-scale-compiler.
Downstream consumers: component-variant-compiler.
Spec file: theme_definition_spec.json – lists modes and overrides.
Error codes: UI026 (mode missing), UI027 (token unmapped), UI028 (a11y fail), UI029 (override conflict), UI030 (dark ignore).
Key invariant: Compiler fails if any token lacks a mapping in all modes.
Safe default: Light mode only with base tokens.

responsive-layout-compiler

Name: responsive-layout-compiler
Frequency: per-project
Input: Breakpoint specs.
Output: responsive_layout.json – rules per breakpoint.
Correctness gates: All declared breakpoints defined; no content loss; covers mobile/desktop; RTL mirroring.
Dependencies: spacing-scale-compiler.
Downstream consumers: grid-system-compiler, data-dense-layout-compiler.
Spec file: responsive_layout_spec.json – defines breakpoints.
Error codes: UI031 (undefined breakpoint), UI032 (content loss), UI033 (RTL miss), UI034 (mobile ignore), UI035 (overlap breaks).
Key invariant: Compiler fails if any breakpoint causes layout overlap.
Safe default: Single desktop breakpoint.

grid-system-compiler

Name: grid-system-compiler
Frequency: per-project
Input: Grid layout rules.
Output: grid_system.json – columns, gutters.
Correctness gates: Gutters match spacing tokens; responsive variants; no fractionals without support.
Dependencies: spacing-scale-compiler, responsive-layout-compiler.
Downstream consumers: data-dense-layout-compiler.
Spec file: grid_system_spec.json – defines columns and gutters.
Error codes: UI036 (gutter mismatch), UI037 (no responsive), UI038 (fractional unsupport), UI039 (column excess), UI040 (gutter zero).
Key invariant: Compiler fails if gutters don't reference spacing tokens.
Safe default: 12-column fixed grid.

iconography-rules-compiler

Name: iconography-rules-compiler
Frequency: per-project
Input: Icon set specs.
Output: icon_rules.json – usage, sizes, colors.
Correctness gates: All icons sized per scale; colors from tokens; no duplicates.
Dependencies: sizing-scale-compiler, color-system-compiler.
Downstream consumers: component-variant-compiler.
Spec file: iconography_rules_spec.json – lists icons and rules.
Error codes: UI041 (size off-scale), UI042 (color non-token), UI043 (duplicate icon), UI044 (usage undefined), UI045 (state miss).
Key invariant: Compiler fails if any icon color isn't a token reference.
Safe default: No icons, text alternatives.

illustration-rules-compiler

Name: illustration-rules-compiler
Frequency: per-project
Input: Illustration guidelines.
Output: illustration_rules.json – styles, placements.
Correctness gates: Placements match grid; colors tokenized; scalable vectors.
Dependencies: color-system-compiler, grid-system-compiler.
Downstream consumers: error-empty-success-compiler.
Spec file: illustration_rules_spec.json – defines styles.
Error codes: UI046 (grid mismatch), UI047 (color non-token), UI048 (non-vector), UI049 (placement conflict), UI050 (scale fail).
Key invariant: Compiler fails if illustrations aren't vector-based.
Safe default: No illustrations.

motion-spec-compiler

Name: motion-spec-compiler
Frequency: per-project
Input: Animation rules, including reduced-motion.
Output: motion_manifest.json – timings, easings.
Correctness gates: All motions <400ms; reduced-motion variants static; cross-checks with a11y-test.
Dependencies: None.
Downstream consumers: state-appearance-compiler.
Spec file: motion_spec_spec.json – lists animations.
Error codes: UI051 (long duration), UI052 (no reduced), UI053 (a11y conflict), UI054 (easing undefined), UI055 (motion conflict).
Key invariant: Compiler fails if any motion lacks reduced-motion variant.
Safe default: Static, no motions.

visual-hierarchy-compiler

Name: visual-hierarchy-compiler
Frequency: per-project
Input: Hierarchy rules.
Output: hierarchy_rules.json – z-index, emphasis.
Correctness gates: Acyclic layers; emphasis uses typography/color tokens.
Dependencies: typography-scale-compiler, color-system-compiler.
Downstream consumers: overlay-presentation-compiler.
Spec file: visual_hierarchy_spec.json – defines layers.
Error codes: UI056 (cyclic hierarchy), UI057 (token miss), UI058 (emphasis undefined), UI059 (z-index conflict), UI060 (layer gap).
Key invariant: Compiler fails if hierarchy has cycles.
Safe default: Flat hierarchy.

semantic-color-map-compiler

Name: semantic-color-map-compiler
Frequency: per-project
Input: Emphasis mappings.
Output: semantic_color_map.json – success/error/etc. to colors.
Correctness gates: All semantics mapped; destructive uses red tones; contrast passes.
Dependencies: color-system-compiler.
Downstream consumers: error-empty-success-compiler, destructive actions in variants.
Spec file: semantic_color_map_spec.json – lists semantics.
Error codes: UI061 (unmapped semantic), UI062 (destructive non-red), UI063 (contrast fail), UI064 (duplicate map), UI065 (mode variance).
Key invariant: Compiler fails if destructive semantic isn't high-contrast red.
Safe default: Neutral colors for all semantics.

component-variant-compiler

Name: component-variant-compiler
Frequency: per-feature
Input: Component intent, including themes.
Output: component_variants.json – visual specs per variant.
Correctness gates: Variants reference only tokens; covers dark/high contrast; cross-checks with react-component (aligns).
Dependencies: theme-definition-compiler, shape_tokens.
Downstream consumers: state-appearance-compiler.
Spec file: component_variant_spec.json – defines variants.
Error codes: UI066 (non-token ref), UI067 (mode miss), UI068 (react mismatch), UI069 (variant explosion), UI070 (RTL ignore).
Key invariant: Compiler fails if any variant uses undefined token.
Safe default: Base variant only.

state-appearance-compiler

Name: state-appearance-compiler
Frequency: per-feature
Input: State specs, hover/focus/etc.
Output: state_matrix.json – appearances per state/variant.
Correctness gates: Covers disabled/hover/focus/active/selected; state explosion managed; motions referenced.
Dependencies: component-variant-compiler, motion-spec-compiler.
Downstream consumers: skeleton-loading-compiler.
Spec file: state_appearance_spec.json – lists states.
Error codes: UI071 (state miss), UI072 (explosion excess), UI073 (motion undef), UI074 (focus ignore), UI075 (disabled undefined).
Key invariant: Compiler fails if any state lacks appearance definition.
Safe default: Static default state.

skeleton-loading-compiler

Name: skeleton-loading-compiler
Frequency: per-feature
Input: Loading patterns.
Output: skeleton_specs.json – visual placeholders.
Correctness gates: Matches component shapes; uses gray tones; no content reveal.
Dependencies: component-variant-compiler.
Downstream consumers: error-empty-success-compiler.
Spec file: skeleton_loading_spec.json – defines placeholders.
Error codes: UI076 (shape mismatch), UI077 (non-gray), UI078 (content leak), UI079 (animation conflict), UI080 (mode ignore).
Key invariant: Compiler fails if skeleton reveals actual content structure.
Safe default: Generic shimmer bars.

error-empty-success-compiler

Name: error-empty-success-compiler
Frequency: per-feature
Input: State patterns.
Output: visual_patterns.json – visuals for states.
Correctness gates: Uses semantic colors; illustrations optional but ruled; cross-checks with page states.
Dependencies: semantic-color-map-compiler, illustration-rules-compiler.
Downstream consumers: handoff-annotation-compiler.
Spec file: error_empty_success_spec.json – defines patterns.
Error codes: UI081 (semantic miss), UI082 (illustration break), UI083 (page mismatch), UI084 (empty undefined), UI085 (error no action).
Key invariant: Compiler fails if error state lacks call-to-action.
Safe default: Text-only states.

data-dense-layout-compiler

Name: data-dense-layout-compiler
Frequency: per-feature
Input: Dense UI specs, tables/charts.
Output: dense_layout.json – compact rules.
Correctness gates: Reduced spacing; readable in dense; responsive collapses.
Dependencies: grid-system-compiler, responsive-layout-compiler.
Downstream consumers: table-styling-compiler, chart-vis-styling-compiler.
Spec file: data_dense_layout_spec.json – defines density.
Error codes: UI086 (spacing not reduced), UI087 (unreadable dense), UI088 (no collapse), UI089 (grid mismatch), UI090 (breakpoint ignore).
Key invariant: Compiler fails if dense layout violates readability min.
Safe default: Standard spacing layout.

form-field-visual-compiler

Name: form-field-visual-compiler
Frequency: per-feature
Input: Form rules.
Output: form_visual_rules.json – styles for fields.
Correctness gates: States covered; long strings handled; cross-checks with react-form.
Dependencies: state-appearance-compiler.
Downstream consumers: None.
Spec file: form_field_visual_spec.json – defines rules.
Error codes: UI091 (state miss), UI092 (string overflow), UI093 (react-form mismatch), UI094 (label undefined), UI095 (error visual weak).
Key invariant: Compiler fails if fields don't handle long localized strings.
Safe default: Browser default form styles.

table-styling-compiler

Name: table-styling-compiler
Frequency: per-feature
Input: Table rules, dense tables.
Output: table_rules.json – borders, zebra, etc.
Correctness gates: Zebra uses subtle colors; sortable indicators; dense variants.
Dependencies: data-dense-layout-compiler.
Downstream consumers: None.
Spec file: table_styling_spec.json – defines styles.
Error codes: UI096 (zebra strong), UI097 (no sortable), UI098 (dense miss), UI099 (border conflict), UI100 (header undefined).
Key invariant: Compiler fails if table lacks sortable visual cues.
Safe default: Plain borders only.

chart-vis-styling-compiler

Name: chart-vis-styling-compiler
Frequency: per-feature
Input: Chart rules.
Output: chart_rules.json – colors, axes.
Correctness gates: Colors from semantics; accessible labels; no color-only legends.
Dependencies: semantic-color-map-compiler.
Downstream consumers: None.
Spec file: chart_vis_styling_spec.json – defines rules.
Error codes: UI101 (non-semantic color), UI102 (label miss), UI103 (color-only legend), UI104 (axis undefined), UI105 (mode variance).
Key invariant: Compiler fails if charts rely on color alone for data.
Safe default: Monochrome charts.

overlay-presentation-compiler

Name: overlay-presentation-compiler
Frequency: per-feature
Input: Overlay rules.
Output: overlay_rules.json – modals/drawers.
Correctness gates: Backdrops dim; close affordances; z-index per hierarchy.
Dependencies: visual-hierarchy-compiler.
Downstream consumers: None.
Spec file: overlay_presentation_spec.json – defines rules.
Error codes: UI106 (no dim), UI107 (close miss), UI108 (z-index wrong), UI109 (escape ignore), UI110 (mobile overflow).
Key invariant: Compiler fails if overlay lacks close affordance.
Safe default: Full-screen overlays.

handoff-annotation-compiler

Name: handoff-annotation-compiler
Frequency: per-feature
Input: Visual intent.
Output: visual_annotations.json – notes on specs.
Correctness gates: References valid artifacts; no subjective; coverage binary.
Dependencies: component-variant-compiler.
Downstream consumers: ab-visual-variant-compiler.
Spec file: handoff_annotation_spec.json – defines annotations.
Error codes: UI111 (invalid ref), UI112 (subjective note), UI113 (coverage gap), UI114 (duplicate), UI115 (spec mismatch).
Key invariant: Compiler fails if annotation is subjective.
Safe default: No annotations.

ab-visual-variant-compiler

Name: ab-visual-variant-compiler
Frequency: per-experiment
Input: Experiment specs.
Output: visual_variants.json – A/B visuals.
Correctness gates: Maps to feature-flag; no drift from base; cross-checks with feature-flag.
Dependencies: component-variant-compiler.
Downstream consumers: system-drift-report-compiler.
Spec file: ab_visual_variant_spec.json – defines variants.
Error codes: UI116 (flag mismatch), UI117 (base drift), UI118 (variant undefined), UI119 (mode ignore), UI120 (a11y fail).
Key invariant: Compiler fails if variant doesn't map to flag.
Safe default: No variants, base only.

system-drift-report-compiler

Name: system-drift-report-compiler
Frequency: per-experiment
Input: Token and component artifacts.
Output: drift_report.json – design system drifts.
Correctness gates: Lists all drifts; zero for pass; references artifacts.
Dependencies: All token compilers.
Downstream consumers: None.
Spec file: system_drift_spec.json – references artifacts.
Error codes: UI121 (drift miss), UI122 (false positive), UI123 (artifact ignore), UI124 (token drift), UI125 (mode drift).
Key invariant: Compiler fails if report omits drifts.
Safe default: Assume no drift.

token-mismatch-report-compiler

Name: token-mismatch-report-compiler
Frequency: per-experiment
Input: Token and implementation artifacts.
Output: mismatch_report.json – token vs. shipped mismatches.
Correctness gates: All mismatches listed; cross-checks with react-component/page.
Dependencies: All token compilers, react-component.
Downstream consumers: None.
Spec file: token_mismatch_spec.json – references artifacts.
Error codes: UI126 (mismatch miss), UI127 (false mismatch), UI128 (component ignore), UI129 (token undef), UI130 (state mismatch).
Key invariant: Compiler fails if report omits any token mismatch.
Safe default: Assume full match.

Recommended Build Order
Considering the dependency graph (e.g., foundational tokens before themes and variants) and priority (per-project before per-feature before per-experiment), the build order is:

Foundational per-project tokens (no/minimal deps): color-system-compiler, typography-scale-compiler, spacing-scale-compiler, sizing-scale-compiler, radius-border-shadow-compiler, motion-spec-compiler.
Per-project systems (depend on tokens): theme-definition-compiler, responsive-layout-compiler, grid-system-compiler, iconography-rules-compiler, illustration-rules-compiler, visual-hierarchy-compiler, semantic-color-map-compiler.
Per-feature applications (depend on systems): component-variant-compiler, state-appearance-compiler, skeleton-loading-compiler, error-empty-success-compiler, data-dense-layout-compiler, form-field-visual-compiler, table-styling-compiler, chart-vis-styling-compiler, overlay-presentation-compiler, handoff-annotation-compiler.
Per-experiment (depend on all above): ab-visual-variant-compiler, system-drift-report-compiler, token-mismatch-report-compiler.

This order ensures dependencies are built first, starting with project-level systems before feature applications.
