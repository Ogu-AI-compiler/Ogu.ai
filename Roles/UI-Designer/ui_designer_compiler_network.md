# UI Designer Compiler Network
> Domain Compiler Network — UI Designer Role Decomposition
> Generated for: formal compiler network build planning
> Excludes already-built and shared/cross-role compilers

---

## Summary Table

| Task Name (Compiler ID) | Frequency | Input | Output |
|---|---|---|---|
| `design-token-spec` | per-project | Brand primitives, platform targets, token taxonomy | `design-tokens.json` |
| `color-system-spec` | per-project | Brand palette, semantic intent map, contrast requirements | `color-system.json` |
| `typography-scale-spec` | per-project | Typeface list, scale ratio, platform targets, i18n requirements | `typography-scale.json` |
| `spacing-scale-spec` | per-project | Base unit, scale method, component density requirements | `spacing-scale.json` |
| `sizing-scale-spec` | per-project | Touch target requirements, icon sizes, component sizing grid | `sizing-scale.json` |
| `radius-border-shadow-spec` | per-project | Component tier list, elevation model, border token map | `radius-border-shadow.json` |
| `theme-spec` | per-project | Color system, token spec, mode list (light/dark/high-contrast) | `theme-spec.json` |
| `dark-mode-spec` | per-project | Color system, light mode theme, inversion rules | `dark-mode-spec.json` |
| `high-contrast-spec` | per-project | Color system, WCAG AA/AAA targets, semantic color map | `high-contrast-spec.json` |
| `grid-layout-spec` | per-project | Breakpoint list, column counts, gutter/margin rules | `grid-layout-spec.json` |
| `responsive-layout-spec` | per-feature | Grid spec, component list, reflow rules per breakpoint | `responsive-layout-spec.json` |
| `component-visual-variant-spec` | per-feature | Component definition, variant axes, token references | `component-variant-spec.json` |
| `component-state-appearance-spec` | per-feature | Component list, interaction states, token references | `component-state-spec.json` |
| `icon-usage-spec` | per-project | Icon library, semantic intent map, size rules | `icon-usage-spec.json` |
| `illustration-usage-spec` | per-project | Illustration library, context rules, state mapping | `illustration-usage-spec.json` |
| `motion-spec` | per-project | Animation intent map, duration scale, easing functions | `motion-spec.json` |
| `reduced-motion-spec` | per-project | Motion spec, a11y requirements, fallback map | `reduced-motion-spec.json` |
| `skeleton-loading-spec` | per-feature | Component/screen list, content shape map, animation rules | `skeleton-spec.json` |
| `visual-state-matrix` | per-feature | Component/screen list, state taxonomy, token references | `visual-state-matrix.json` |
| `empty-state-visual-spec` | per-feature | Empty state triggers, illustration map, CTA visual rules | `empty-state-visual-spec.json` |
| `form-field-visual-spec` | per-project | Field type list, state list, validation visual rules | `form-field-visual-spec.json` |
| `data-table-visual-spec` | per-feature | Table schema, density modes, row/cell visual rules | `data-table-visual-spec.json` |
| `chart-visualization-spec` | per-feature | Chart types, semantic color map, axis/label rules | `chart-viz-spec.json` |
| `overlay-presentation-spec` | per-project | Overlay types (modal/drawer/popover/toast), sizing rules | `overlay-spec.json` |
| `visual-hierarchy-spec` | per-feature | Screen list, content priority map, emphasis rules | `visual-hierarchy-spec.json` |
| `semantic-color-mapping-spec` | per-project | Color system, semantic intent list, component context map | `semantic-color-map.json` |
| `visual-regression-baseline-spec` | per-feature | Component/screen list, state matrix, viewport list | `visual-regression-spec.json` |
| `experiment-visual-variant-spec` | per-experiment | Feature flag config, variant definitions, token/component delta | `experiment-visual-spec.json` |
| `handoff-visual-annotation-spec` | per-feature | Component variants, state matrix, token references | `handoff-visual-annotations.json` |
| `design-system-drift-report` | daily | Token spec, shipped component output, theme manifest | `drift-report.json` |

---

## Detailed Breakdown

---

### 1. `design-token-spec`

**Frequency:** per-project

**Input:**
- Brand primitive values (raw hex, font names, numeric values)
- Platform target list (web, iOS, Android, email)
- Token taxonomy (primitive / semantic / component-level)
- Token naming convention schema

**Output:**
- `design-tokens.json` — complete token definitions in W3C Design Token Community Group format (or Style Dictionary compatible): token name, value, type, tier (primitive/semantic/component), platform target, alias references

**Spec file:** `design-token-spec.spec.json`
```json
{
  "tokens": [
    {
      "name": "color.blue.500",
      "value": "#3B82F6",
      "type": "color",
      "tier": "primitive"
    },
    {
      "name": "color.interactive.primary",
      "value": "{color.blue.500}",
      "type": "color",
      "tier": "semantic",
      "alias": true
    }
  ]
}
```

**Correctness Gates:**
1. Every token has a unique `name`, a `value`, and a `type`
2. Every semantic token's value is an alias reference to a primitive token (not a raw value)
3. Every alias reference resolves to an existing token (no broken references)
4. No circular alias chains exist
5. Every platform target has at least one token entry
6. Token names follow the declared naming convention schema (validated by regex)
7. Primitive tokens do not reference other tokens (raw values only)
8. Every component-tier token's value aliases a semantic token (not a primitive directly)

**Error Codes:**
- `UI001` — Token alias reference cannot be resolved
- `UI002` — Circular token alias chain detected
- `UI003` — Component token aliases primitive directly (must alias semantic)
- `UI004` — Token name violates naming convention schema
- `UI005` — Duplicate token name detected

**Key Invariant:** Compiler must fail if any semantic or component token contains a raw value instead of an alias reference to a lower-tier token.

**Safe Default:** Without design-token-spec, components use hardcoded values; theming, dark mode, and brand updates require manual code changes across every component.

**Dependencies:**
- Brand primitive values (external input)
- Token naming convention schema (project decision)

**Downstream Consumers:**
- `color-system-spec`
- `typography-scale-spec`
- `spacing-scale-spec`
- `sizing-scale-spec`
- `radius-border-shadow-spec`
- `theme-spec`
- All component-level compilers

---

### 2. `color-system-spec`

**Frequency:** per-project

**Input:**
- Brand palette (primitive colors from `design-token-spec`)
- Semantic intent map (primary, secondary, destructive, success, warning, info, neutral)
- WCAG contrast requirements (AA or AAA)
- Surface/background tier list
- Foreground/text usage rules

**Output:**
- `color-system.json` — structured color definitions: palette scales (50–950 per hue), semantic role assignments, foreground/background pairings, contrast ratios per pair, dark mode equivalents, interactive state color deltas

**Spec file:** `color-system.spec.json`

**Correctness Gates:**
1. Every semantic role has exactly one assigned primitive color per theme mode
2. Every foreground/background pairing has a computed contrast ratio ≥ 4.5:1 (AA) or ≥ 7:1 (AAA) as declared
3. Every interactive state delta (hover, focus, active) is defined for every semantic role
4. Destructive color passes contrast requirements on all declared surface backgrounds
5. Every color in the system is referenced by at least one semantic role (no orphan primitives)
6. All values reference tokens from `design-token-spec` (no raw hex values in semantic entries)
7. Focus indicator color has contrast ≥ 3:1 against adjacent surface

**Error Codes:**
- `UI010` — Foreground/background pairing fails minimum contrast ratio
- `UI011` — Semantic role has no assigned color for a declared theme mode
- `UI012` — Interactive state delta not defined for semantic role
- `UI013` — Color value is raw hex (must reference design token)
- `UI014` — Focus color fails 3:1 contrast against adjacent surface

**Key Invariant:** Compiler must fail if any text/background color pair does not meet the project-declared WCAG contrast threshold.

**Safe Default:** Without color-system-spec, semantic color assignments are inconsistent across components, making contrast compliance unverifiable.

**Dependencies:**
- `design-token-spec.json`

**Downstream Consumers:**
- `theme-spec`
- `dark-mode-spec`
- `high-contrast-spec`
- `semantic-color-mapping-spec`
- `component-visual-variant-spec`
- `component-state-appearance-spec`

---

### 3. `typography-scale-spec`

**Frequency:** per-project

**Input:**
- Typeface list (primary, secondary, monospace, fallback stack)
- Type scale ratio (Major Third, Perfect Fourth, custom)
- Platform targets
- i18n character set requirements (CJK, Arabic, Devanagari, etc.)
- Line height and letter spacing rules

**Output:**
- `typography-scale.json` — type scale definitions: step name (xs/sm/base/lg/xl/2xl/etc.), font-size token, line-height token, letter-spacing token, font-weight options, font-family assignment, responsive overrides, i18n-safe font stack per script

**Spec file:** `typography-scale.spec.json`

**Correctness Gates:**
1. Every type scale step has: `font-size`, `line-height`, and `font-weight` defined
2. All token references resolve to entries in `design-token-spec`
3. Minimum `font-size` is ≥ 12px (or 0.75rem) — no step below this threshold
4. Line height for body text is ≥ 1.4 (WCAG SC 1.4.12)
5. Letter spacing for body text is not negative
6. i18n font stacks are defined for every declared non-Latin script
7. Responsive overrides exist for every breakpoint declared in `grid-layout-spec` for heading steps
8. Cross-compiler: every type step used in page/component artifacts is defined in this spec

**Error Codes:**
- `UI020` — Type scale step missing required property (size/line-height/weight)
- `UI021` — Token reference not resolved in design-token-spec
- `UI022` — Font size below 12px minimum
- `UI023` — Line height below 1.4 for body text step
- `UI024` — i18n font stack missing for declared script

**Key Invariant:** Compiler must fail if any declared type scale step has a font-size token that does not resolve in `design-token-spec`.

**Safe Default:** Without typography-scale-spec, font sizes are arbitrary per component, breaking visual hierarchy and i18n expansion tolerance.

**Dependencies:**
- `design-token-spec.json`
- `grid-layout-spec.json` (for responsive overrides — soft dependency)

**Downstream Consumers:**
- `theme-spec`
- `component-visual-variant-spec`
- `visual-hierarchy-spec`
- `form-field-visual-spec`
- `data-table-visual-spec`

---

### 4. `spacing-scale-spec`

**Frequency:** per-project

**Input:**
- Base spacing unit (4px, 8px, or custom)
- Scale method (linear, t-shirt sizes, exponential)
- Component density requirements (compact / comfortable / spacious)
- Inset vs stack vs inline spacing taxonomy

**Output:**
- `spacing-scale.json` — spacing token definitions: step name (1/2/3/4... or xs/sm/md/lg...), pixel value, rem equivalent, density mode overrides per step, semantic spacing roles (inset-sm, stack-lg, etc.)

**Spec file:** `spacing-scale.spec.json`

**Correctness Gates:**
1. Every spacing step has a pixel value and rem equivalent
2. All values are multiples of the declared base unit
3. Semantic spacing roles exist for: inset, stack, inline, and gap categories
4. Density mode overrides are defined for every step if density modes are declared
5. No two steps have the same pixel value
6. Every spacing token is referenced by a semantic spacing role
7. Minimum spacing step is ≥ 2px

**Error Codes:**
- `UI030` — Spacing step value is not a multiple of base unit
- `UI031` — Duplicate pixel value across steps
- `UI032` — Semantic spacing role missing for inset/stack/inline/gap
- `UI033` — Density mode override missing for declared density
- `UI034` — Spacing step below 2px minimum

**Key Invariant:** Compiler must fail if any spacing step value is not a multiple of the declared base unit.

**Safe Default:** Without spacing-scale-spec, component padding and margins are arbitrary, making density consistency and layout predictability impossible.

**Dependencies:**
- `design-token-spec.json`

**Downstream Consumers:**
- `grid-layout-spec`
- `component-visual-variant-spec`
- `form-field-visual-spec`
- `data-table-visual-spec`
- `theme-spec`

---

### 5. `sizing-scale-spec`

**Frequency:** per-project

**Input:**
- Minimum touch target requirements (WCAG 2.5.5 / 2.5.8: 44px / 24px)
- Icon size tier list
- Component height tiers (small / medium / large)
- Avatar / thumbnail size variants
- Thumbnail and media aspect ratios

**Output:**
- `sizing-scale.json` — sizing token definitions: named size steps with pixel values, touch target minimums, icon size tiers, component height tiers, aspect ratio definitions, media sizing rules

**Spec file:** `sizing-scale.spec.json`

**Correctness Gates:**
1. Every interactive element size tier meets the declared minimum touch target (≥ 44px for WCAG 2.5.5 or ≥ 24px for 2.5.8 with spacing)
2. Every icon size tier is a multiple of 4px
3. Component height tiers have a minimum, medium, and large defined
4. All values reference tokens from `design-token-spec`
5. No interactive size tier is smaller than the declared touch target minimum
6. Aspect ratios are defined as exact ratios (e.g., `16:9`, not `"widescreen"`)

**Error Codes:**
- `UI040` — Interactive size tier below touch target minimum
- `UI041` — Icon size not a multiple of 4px
- `UI042` — Component height tier missing (small/medium/large required)
- `UI043` — Sizing token missing design-token-spec reference
- `UI044` — Aspect ratio defined as label instead of numeric ratio

**Key Invariant:** Compiler must fail if any declared interactive component size tier falls below the project's declared minimum touch target.

**Safe Default:** Without sizing-scale-spec, touch targets are inconsistent, creating accessibility failures on mobile.

**Dependencies:**
- `design-token-spec.json`

**Downstream Consumers:**
- `component-visual-variant-spec`
- `icon-usage-spec`
- `form-field-visual-spec`
- `responsive-layout-spec`

---

### 6. `radius-border-shadow-spec`

**Frequency:** per-project

**Input:**
- Component tier list (small/medium/large components, cards, overlays)
- Elevation model (flat, layered, floating)
- Border weight options
- Shadow style philosophy (hard, soft, ambient)
- Dark mode shadow adjustments

**Output:**
- `radius-border-shadow.json` — token definitions for: border-radius steps (none/sm/md/lg/full), border-width steps (hairline/thin/medium/thick), border-color semantic roles, shadow/elevation tiers (0–5), dark mode shadow overrides

**Spec file:** `radius-border-shadow.spec.json`

**Correctness Gates:**
1. Every radius step has a pixel value and a descriptive name
2. Every shadow/elevation tier has a complete CSS box-shadow value (offsets, blur, spread, color with opacity)
3. Shadow color tokens reference semantic color tokens (not raw rgba)
4. Dark mode shadow overrides are defined for every elevation tier
5. Border-color roles reference semantic color tokens from `color-system-spec`
6. All token values reference `design-token-spec` entries
7. `border-radius: full` is defined as `9999px` or equivalent pill shape

**Error Codes:**
- `UI050` — Shadow color is raw rgba value (must reference token)
- `UI051` — Elevation tier missing dark mode override
- `UI052` — Border-color role references undefined color token
- `UI053` — Shadow tier missing any one of: offset, blur, spread, color
- `UI054` — Radius step value not defined in design-token-spec

**Key Invariant:** Compiler must fail if any elevation tier has no dark mode shadow override defined when dark mode is a declared theme.

**Safe Default:** Without this spec, shadows and borders are arbitrary, creating inconsistent elevation perception and dark mode rendering artifacts.

**Dependencies:**
- `design-token-spec.json`
- `color-system-spec.json`

**Downstream Consumers:**
- `theme-spec`
- `component-visual-variant-spec`
- `overlay-presentation-spec`
- `dark-mode-spec`

---

### 7. `theme-spec`

**Frequency:** per-project

**Input:**
- `color-system.json`
- `typography-scale.json`
- `spacing-scale.json`
- `sizing-scale.json`
- `radius-border-shadow.json`
- Theme mode list (light, dark, high-contrast, brand variants)

**Output:**
- `theme-spec.json` — complete theme manifest: per-mode token overrides, CSS custom property mapping, theme class names, token resolution order, platform-specific theme outputs (web CSS vars, iOS JSON, Android XML)

**Spec file:** `theme-spec.spec.json`

**Correctness Gates:**
1. Every declared theme mode has a complete token override set (no missing token in any mode)
2. Every token in the theme resolves to a value in `design-token-spec`
3. CSS custom property names follow the declared naming convention
4. Token resolution order is explicitly defined (no ambiguous override precedence)
5. Every theme mode has been validated against contrast requirements from `color-system-spec`
6. Platform-specific outputs (if declared) cover all declared platform targets
7. Theme class name is unique per mode (no name collisions)

**Error Codes:**
- `UI060` — Theme mode missing token definition
- `UI061` — Token in theme does not resolve in design-token-spec
- `UI062` — Contrast requirement failure in theme mode
- `UI063` — Duplicate theme class name
- `UI064` — Platform-specific output missing for declared target

**Key Invariant:** Compiler must fail if any theme mode has a token that does not fully resolve through the alias chain to a primitive value.

**Safe Default:** Without theme-spec, there is no authoritative token resolution order; dark mode and brand variants ship as manual overrides with no system validation.

**Dependencies:**
- `design-token-spec.json`
- `color-system-spec.json`
- `typography-scale-spec.json`
- `spacing-scale-spec.json`
- `sizing-scale-spec.json`
- `radius-border-shadow-spec.json`

**Downstream Consumers:**
- `dark-mode-spec`
- `high-contrast-spec`
- `component-visual-variant-spec`
- `component-state-appearance-spec`
- All visual compilers (theme is the universal dependency)

---

### 8. `dark-mode-spec`

**Frequency:** per-project

**Input:**
- `color-system.json`
- `theme-spec.json` (light mode as baseline)
- Inversion rules (which surfaces invert, which remain)
- Image/illustration adaptation rules
- Shadow adaptation rules

**Output:**
- `dark-mode-spec.json` — dark mode token overrides: semantic color reassignments, surface hierarchy in dark (not simple inversion), shadow opacity adjustments, image overlay rules, border visibility adjustments, per-component dark mode exceptions

**Spec file:** `dark-mode-spec.spec.json`

**Correctness Gates:**
1. Every semantic color role from `color-system-spec` has a dark mode override
2. Dark mode is not a simple luminance inversion (surfaces must maintain hierarchy: darkest background is base, not lightest)
3. All dark mode color pairs pass contrast requirements from `color-system-spec`
4. Shadow tokens have reduced opacity in dark mode (not removed entirely for flat UI)
5. Every image overlay rule specifies an opacity value (not just "dim")
6. Per-component exceptions are enumerated (not implied by silence)
7. Cross-compiler: dark mode overrides map to theme-spec token names exactly

**Error Codes:**
- `UI070` — Semantic color role missing dark mode override
- `UI071` — Dark mode color pair fails contrast requirement
- `UI072` — Shadow token removed entirely in dark mode (must be adjusted, not removed)
- `UI073` — Image overlay rule specifies no opacity value
- `UI074` — Dark mode token name does not match theme-spec token name

**Key Invariant:** Compiler must fail if dark mode is a simple luminance inversion (all lightest colors mapped to darkest), which destroys surface hierarchy.

**Safe Default:** Without dark-mode-spec, dark mode is implemented as a CSS filter inversion, producing unacceptable visual artifacts and contrast failures.

**Dependencies:**
- `theme-spec.json`
- `color-system-spec.json`
- `radius-border-shadow-spec.json`

**Downstream Consumers:**
- `theme-spec` (dark mode token set feeds back into theme manifest)
- `component-state-appearance-spec`
- `visual-regression-baseline-spec`

---

### 9. `high-contrast-spec`

**Frequency:** per-project

**Input:**
- `color-system.json`
- WCAG AAA contrast targets (7:1 text, 4.5:1 UI components)
- Windows High Contrast / forced-colors mode requirements
- Semantic color reduction rules (fewer hues, higher contrast)

**Output:**
- `high-contrast-spec.json` — high-contrast theme token overrides: AAA-compliant color pairs, forced-colors media query mappings, border additions for elements that rely on color alone, focus indicator enhancements, shadow removal rules

**Spec file:** `high-contrast-spec.spec.json`

**Correctness Gates:**
1. Every text/background pair achieves ≥ 7:1 contrast ratio
2. Every UI component (button, input, checkbox) achieves ≥ 4.5:1 contrast on its boundary
3. Forced-colors media query mappings are defined for all semantic color roles
4. Elements that previously relied on color alone for state communication have border additions
5. Focus indicators have a minimum 2px outline with ≥ 3:1 contrast against adjacent surface
6. All shadow tokens are explicitly removed or replaced with borders in high-contrast mode
7. Cross-compiler: every override maps to an existing token in `theme-spec`

**Error Codes:**
- `UI080` — Text/background pair fails 7:1 AAA contrast
- `UI081` — UI component boundary fails 4.5:1 contrast
- `UI082` — Forced-colors mapping missing for semantic color role
- `UI083` — State communicated by color alone with no border addition
- `UI084` — Focus indicator below 2px or below 3:1 contrast

**Key Invariant:** Compiler must fail if any text/background token pair in the high-contrast theme achieves less than 7:1 contrast ratio.

**Safe Default:** Without high-contrast-spec, users requiring high contrast receive the standard theme, which may fail WCAG AAA and Windows High Contrast mode.

**Dependencies:**
- `color-system-spec.json`
- `theme-spec.json`

**Downstream Consumers:**
- `theme-spec` (high-contrast mode feeds into theme manifest)
- `component-state-appearance-spec`
- `visual-regression-baseline-spec`

---

### 10. `grid-layout-spec`

**Frequency:** per-project

**Input:**
- Breakpoint definitions (names, min-width values)
- Column count per breakpoint
- Gutter width per breakpoint
- Margin/padding per breakpoint
- Max content width
- Fluid vs fixed layout strategy

**Output:**
- `grid-layout-spec.json` — layout grid definition: breakpoint list (name, min-width), columns per breakpoint, gutter token reference, margin token reference, max-width value, layout strategy (fluid/fixed/hybrid)

**Spec file:** `grid-layout-spec.spec.json`

**Correctness Gates:**
1. Every breakpoint has: name, `min-width`, column count, gutter, and margin defined
2. Column count decreases monotonically as breakpoint width decreases (no narrower breakpoint has more columns)
3. Gutter and margin values reference spacing tokens from `spacing-scale-spec`
4. Max-width is defined for at least the widest breakpoint
5. Breakpoint names are unique and follow a consistent naming convention
6. Layout strategy is one of: `fluid` | `fixed` | `hybrid`
7. Cross-compiler: breakpoints defined here must be the authoritative set referenced by all downstream layout specs

**Error Codes:**
- `UI090` — Breakpoint missing required property (min-width/columns/gutter/margin)
- `UI091` — Column count does not decrease at smaller breakpoint
- `UI092` — Gutter/margin references undefined spacing token
- `UI093` — Max-width not defined for widest breakpoint
- `UI094` — Duplicate breakpoint name

**Key Invariant:** Compiler must fail if any breakpoint's column count exceeds the column count of a wider breakpoint (column count must be non-increasing as width decreases).

**Safe Default:** Without grid-layout-spec, layouts are implemented without a shared column/gutter system, causing inconsistent page margins and alignment across features.

**Dependencies:**
- `spacing-scale-spec.json`

**Downstream Consumers:**
- `responsive-layout-spec`
- `typography-scale-spec` (responsive type overrides)
- `component-visual-variant-spec`
- `data-table-visual-spec`

---

### 11. `responsive-layout-spec`

**Frequency:** per-feature

**Input:**
- `grid-layout-spec.json`
- Screen/page list for the feature
- Component list with layout roles (hero, sidebar, card-grid, etc.)
- Column span rules per component per breakpoint
- Reflow and stack rules

**Output:**
- `responsive-layout-spec.json` — per-screen, per-breakpoint layout definition: component placement, column spans, row definitions, stack order on mobile, hidden/visible flags per breakpoint, container queries if used

**Spec file:** `responsive-layout-spec.spec.json`

**Correctness Gates:**
1. Every screen has a layout definition for every declared breakpoint
2. Column spans never exceed the column count for the breakpoint
3. Every component that collapses at a breakpoint has an explicit stack order defined
4. Hidden components at a breakpoint are not sole carriers of critical information
5. All column span and gutter values reference `grid-layout-spec` tokens
6. No layout definition creates horizontal overflow at any declared breakpoint
7. Cross-compiler: every screen referenced maps to an existing `react-page` artifact or is flagged `planned`

**Error Codes:**
- `UI100` — Screen missing layout for declared breakpoint
- `UI101` — Column span exceeds breakpoint column count
- `UI102` — Collapsed component missing stack order
- `UI103` — Critical component hidden at breakpoint
- `UI104` — Screen reference not found in react-page registry

**Key Invariant:** Compiler must fail if any component's column span exceeds the total column count for any declared breakpoint.

**Safe Default:** Without responsive-layout-spec, pages reflow unpredictably on mobile, breaking content hierarchy.

**Dependencies:**
- `grid-layout-spec.json`
- `sizing-scale-spec.json`

**Downstream Consumers:**
- `wireframe-manifest` (UX compiler — layout reference)
- `visual-hierarchy-spec`
- `handoff-visual-annotation-spec`

---

### 12. `component-visual-variant-spec`

**Frequency:** per-feature

**Input:**
- Component definition (name, variant axes: size, intent, shape, density)
- Token references (color, typography, spacing, sizing, radius)
- Visual variant matrix (all combinations of axes)
- `theme-spec.json`

**Output:**
- `component-variant-spec.json` — per-component variant definitions: variant axis list, all valid combinations, per-combination token map (background, foreground, border, shadow, spacing, typography), invalid combinations (explicitly enumerated)

**Spec file:** `component-variant-spec.spec.json`

**Correctness Gates:**
1. Every declared variant axis combination has an explicit token map
2. Every token in the map resolves in `design-token-spec`
3. No variant combination maps to a raw value (all must be token references)
4. Invalid combinations are explicitly listed (not implied by absence)
5. Every variant combination passes contrast requirements from `color-system-spec`
6. Cross-compiler: variant names must match the variant prop names in the corresponding `react-component` output
7. Every size variant references a value from `sizing-scale-spec`
8. Density variants (compact/comfortable/spacious) reference `spacing-scale-spec` tokens

**Error Codes:**
- `UI110` — Variant combination missing token map
- `UI111` — Token reference not resolved in design-token-spec
- `UI112` — Variant combination uses raw value instead of token
- `UI113` — Variant name does not match react-component prop
- `UI114` — Variant combination fails contrast requirement

**Key Invariant:** Compiler must fail if any valid variant combination has a token reference that does not resolve through the alias chain to a primitive value.

**Safe Default:** Without component-variant-spec, component visual variants are implemented inconsistently, with undocumented combinations causing visual regressions.

**Dependencies:**
- `design-token-spec.json`
- `theme-spec.json`
- `color-system-spec.json`
- `typography-scale-spec.json`
- `spacing-scale-spec.json`
- `sizing-scale-spec.json`
- `radius-border-shadow-spec.json`

**Downstream Consumers:**
- `component-state-appearance-spec`
- `visual-state-matrix`
- `handoff-visual-annotation-spec`
- `visual-regression-baseline-spec`

---

### 13. `component-state-appearance-spec`

**Frequency:** per-feature

**Input:**
- Component list with interaction state list (default, hover, focus, active, selected, disabled, loading, error, success)
- `component-visual-variant-spec.json`
- `theme-spec.json`
- Dark mode / high-contrast overrides

**Output:**
- `component-state-spec.json` — per-component, per-state appearance definition: state name, token deltas from default (only changed tokens listed), focus ring spec, disabled opacity rule, cursor override, animation trigger reference

**Spec file:** `component-state-spec.spec.json`

**Correctness Gates:**
1. Every interactive component has all mandatory states defined: `default`, `hover`, `focus`, `active`, `disabled`
2. Focus state has a visible focus ring defined (color, width, offset)
3. Disabled state has `pointer-events: none` and opacity rule defined
4. Focus ring meets 3:1 contrast against adjacent surface in all theme modes
5. State token deltas reference only existing tokens (no new raw values)
6. States that only differ by color have verified contrast for all combinations
7. Dark mode state tokens are defined for every state (not inherited by assumption)
8. Cross-compiler: state names must match state-related prop/class names in `react-component` output

**Error Codes:**
- `UI120` — Interactive component missing mandatory state (hover/focus/active/disabled)
- `UI121` — Focus ring missing or undefined
- `UI122` — Focus ring fails 3:1 contrast in any theme mode
- `UI123` — Disabled state missing pointer-events or opacity rule
- `UI124` — State name does not match react-component implementation

**Key Invariant:** Compiler must fail if any interactive component has no visible focus state defined.

**Safe Default:** Without component-state-appearance-spec, interactive states are inconsistent; focus indicators are missing, creating keyboard accessibility failures.

**Dependencies:**
- `component-visual-variant-spec.json`
- `theme-spec.json`
- `dark-mode-spec.json`
- `high-contrast-spec.json`

**Downstream Consumers:**
- `visual-state-matrix`
- `skeleton-loading-spec`
- `handoff-visual-annotation-spec`
- `visual-regression-baseline-spec`

---

### 14. `icon-usage-spec`

**Frequency:** per-project

**Input:**
- Icon library (SVG set, icon names, categories)
- Semantic intent map (which icons communicate which meaning)
- Size rules (from `sizing-scale-spec`)
- Color rules (icon color token assignments)
- Accessibility labeling requirements

**Output:**
- `icon-usage-spec.json` — icon usage rules: icon name, semantic intent, allowed sizes, color token assignments, interactive/decorative flag, accessible label requirement, RTL flip rule, forbidden contexts

**Spec file:** `icon-usage-spec.spec.json`

**Correctness Gates:**
1. Every icon has a `semantic_intent` or is explicitly flagged `decorative`
2. Interactive icons have `accessible_label: required`
3. Decorative icons have `accessible_label: none` (aria-hidden)
4. Every icon's color assignment references a semantic color token
5. RTL flip rule is defined for every directional icon (arrows, chevrons, back)
6. Allowed sizes reference `sizing-scale-spec` icon size tiers
7. Forbidden contexts are enumerated for icons with narrow semantic meaning

**Error Codes:**
- `UI130` — Icon missing semantic_intent or decorative flag
- `UI131` — Interactive icon missing accessible label requirement
- `UI132` — Icon color references raw value instead of token
- `UI133` — Directional icon missing RTL flip rule
- `UI134` — Icon size not in sizing-scale-spec icon tiers

**Key Invariant:** Compiler must fail if any interactive icon has no `accessible_label` requirement defined.

**Safe Default:** Without icon-usage-spec, icons are used arbitrarily without semantic intent, creating inconsistent meaning and accessibility failures.

**Dependencies:**
- `design-token-spec.json`
- `sizing-scale-spec.json`
- `color-system-spec.json`

**Downstream Consumers:**
- `component-visual-variant-spec`
- `empty-state-visual-spec`
- `handoff-visual-annotation-spec`

---

### 15. `illustration-usage-spec`

**Frequency:** per-project

**Input:**
- Illustration library (file list, categories, contexts)
- Contextual usage rules (onboarding / empty state / error / marketing)
- Dark mode illustration variants (available or CSS-adapted)
- Sizing and placement rules
- Accessibility alt-text requirements

**Output:**
- `illustration-usage-spec.json` — illustration usage rules: illustration ID, allowed contexts, dark mode variant availability, max display size, accessible alt-text template, RTL-mirror rule, forbidden contexts

**Spec file:** `illustration-usage-spec.spec.json`

**Correctness Gates:**
1. Every illustration has at least one `allowed_context` defined
2. Dark mode variant availability is explicitly declared (`available` / `css-adapted` / `none`)
3. If dark mode variant is `none`, a fallback rule is defined (hide / show with overlay)
4. Every non-decorative illustration has an `alt_text_template`
5. RTL mirror rule is defined for every illustration with directional content
6. Forbidden contexts are enumerated where relevant

**Error Codes:**
- `UI140` — Illustration missing allowed_context
- `UI141` — Dark mode variant status not declared
- `UI142` — Dark mode variant is none with no fallback rule
- `UI143` — Non-decorative illustration missing alt_text_template
- `UI144` — Directional illustration missing RTL mirror rule

**Key Invariant:** Compiler must fail if any illustration used in a dark mode context has no dark mode variant and no fallback rule.

**Safe Default:** Without illustration-usage-spec, illustrations render without dark mode variants, causing bright flashes or color inconsistency in dark mode.

**Dependencies:**
- `dark-mode-spec.json`
- `color-system-spec.json`

**Downstream Consumers:**
- `empty-state-visual-spec`
- `skeleton-loading-spec`
- `handoff-visual-annotation-spec`

---

### 16. `motion-spec`

**Frequency:** per-project

**Input:**
- Animation intent categories (enter, exit, transition, emphasis, feedback)
- Duration scale requirements
- Easing function library
- Platform motion guidelines (iOS HIG, Material, custom)

**Output:**
- `motion-spec.json` — motion token definitions: duration steps (instant/fast/normal/slow/deliberate with ms values), easing functions (named with cubic-bezier values), per-intent motion rules (which duration + easing), animation property list (transform/opacity/max-height/etc.)

**Spec file:** `motion-spec.spec.json`

**Correctness Gates:**
1. Every duration step has a millisecond value
2. Every easing function is defined as a valid `cubic-bezier(x1, y1, x2, y2)` or named CSS value
3. Every animation intent category has an assigned duration + easing combination
4. Enter and exit animations for the same element use complementary easing (ease-out for enter, ease-in for exit)
5. No duration step exceeds 400ms for UI feedback animations (enter/exit of small components)
6. All motion tokens reference `design-token-spec` entries
7. Cross-compiler: motion spec does not define any animation that conflicts with `a11y-test` motion policies

**Error Codes:**
- `UI150` — Duration step missing millisecond value
- `UI151` — Easing function is not a valid cubic-bezier or named CSS value
- `UI152` — Animation intent category missing duration/easing assignment
- `UI153` — UI feedback animation duration exceeds 400ms
- `UI154` — Motion definition conflicts with a11y-test policy

**Key Invariant:** Compiler must fail if any animation intent has no assigned easing function.

**Safe Default:** Without motion-spec, animations are arbitrary per component, creating inconsistent timing and violating platform motion guidelines.

**Dependencies:**
- `design-token-spec.json`
- `a11y-test` (shared compiler — cross-check)

**Downstream Consumers:**
- `reduced-motion-spec`
- `component-state-appearance-spec`
- `skeleton-loading-spec`
- `overlay-presentation-spec`

---

### 17. `reduced-motion-spec`

**Frequency:** per-project

**Input:**
- `motion-spec.json`
- `a11y-test` requirements (prefers-reduced-motion)
- Per-animation fallback strategy
- Essential motion list (animations required for comprehension)

**Output:**
- `reduced-motion-spec.json` — per-animation fallback map: animation ID, original motion spec reference, reduced-motion strategy (`instant` / `opacity-only` / `preserve-essential`), essential flag, CSS media query mapping

**Spec file:** `reduced-motion-spec.spec.json`

**Correctness Gates:**
1. Every animation defined in `motion-spec` has a reduced-motion fallback entry
2. Fallback strategy is one of: `instant` | `opacity-only` | `preserve-essential`
3. `preserve-essential` animations have a documented justification
4. `instant` fallback means transition duration is `0ms` or `1ms` maximum
5. `prefers-reduced-motion: reduce` media query mapping is defined for every animation
6. No reduced-motion fallback introduces new layout shifts

**Error Codes:**
- `UI160` — Animation missing reduced-motion fallback entry
- `UI161` — Fallback strategy is not one of the three valid values
- `UI162` — Preserve-essential animation missing justification
- `UI163` — Instant fallback duration exceeds 1ms
- `UI164` — Reduced-motion fallback introduces layout shift

**Key Invariant:** Compiler must fail if any animation defined in `motion-spec` has no corresponding fallback in this spec.

**Safe Default:** Without reduced-motion-spec, users with vestibular disorders experience full animation regardless of OS preference settings.

**Dependencies:**
- `motion-spec.json`
- `a11y-test` (shared compiler)

**Downstream Consumers:**
- `component-state-appearance-spec`
- `skeleton-loading-spec`
- `handoff-visual-annotation-spec`

---

### 18. `skeleton-loading-spec`

**Frequency:** per-feature

**Input:**
- Component and screen list with content shape inventory
- Animation rules from `motion-spec`
- Reduced motion rules from `reduced-motion-spec`
- Theme tokens for skeleton colors

**Output:**
- `skeleton-spec.json` — per-surface skeleton loading definition: content slot shapes (text-line/image/avatar/card/table-row), shimmer animation reference, skeleton color tokens (base/highlight), reduced-motion variant (static skeleton), timing before skeleton appears (threshold delay)

**Spec file:** `skeleton-spec.spec.json`

**Correctness Gates:**
1. Every screen with async data has a skeleton spec entry
2. Every content slot type is one of: `text-line` | `image` | `avatar` | `card` | `table-row` | `custom`
3. Skeleton color tokens reference theme tokens (not raw values)
4. Shimmer animation references a duration from `motion-spec`
5. Reduced-motion variant is defined (static skeleton, no shimmer)
6. Skeleton appearance delay threshold is defined (show skeleton only after N ms, not immediately)
7. Skeleton layout matches the approximate shape of the loaded content (same column count, approximate line count)

**Error Codes:**
- `UI170` — Screen with async data missing skeleton spec
- `UI171` — Content slot type is not a declared valid type
- `UI172` — Skeleton color is raw value instead of theme token
- `UI173` — Shimmer animation not referenced from motion-spec
- `UI174` — Reduced-motion static variant not defined

**Key Invariant:** Compiler must fail if any screen with a data loading state has no skeleton loading spec entry.

**Safe Default:** Without skeleton-loading-spec, loading states render as blank screens or full-page spinners, increasing perceived load time.

**Dependencies:**
- `theme-spec.json`
- `motion-spec.json`
- `reduced-motion-spec.json`

**Downstream Consumers:**
- `visual-state-matrix`
- `visual-regression-baseline-spec`
- `handoff-visual-annotation-spec`

---

### 19. `visual-state-matrix`

**Frequency:** per-feature

**Input:**
- Component and screen list
- State taxonomy (loading / skeleton / empty / partial / error / success / disabled / offline)
- `component-state-appearance-spec.json`
- `skeleton-loading-spec.json`
- Theme modes to validate against

**Output:**
- `visual-state-matrix.json` — per-surface visual state coverage: state type, visual treatment reference (token map or skeleton spec ID or illustration ID), theme mode coverage (light/dark/high-contrast), viewport coverage (mobile/desktop)

**Spec file:** `visual-state-matrix.spec.json`

**Correctness Gates:**
1. Every screen has entries for all four core states: `loading`, `empty`, `error`, `success`
2. Every state entry references a visual treatment (token reference / skeleton ID / illustration ID)
3. All theme modes are covered for every state entry
4. `partial` data state is defined for any screen that renders with incomplete data
5. `offline` state is defined for any network-dependent screen
6. Cross-compiler: every state in the UX `state-matrix` has a corresponding visual treatment here
7. No state entry references an undefined token or spec ID

**Error Codes:**
- `UI180` — Screen missing core state definition (loading/empty/error/success)
- `UI181` — State entry missing visual treatment reference
- `UI182` — Theme mode not covered for state entry
- `UI183` — State references undefined token or spec ID
- `UI184` — UX state-matrix state has no visual treatment counterpart

**Key Invariant:** Compiler must fail if any screen has a defined UX state (from `state-matrix`) with no corresponding visual treatment defined in this matrix.

**Safe Default:** Without visual-state-matrix, loading/error/empty states are visually inconsistent, with some screens showing spinners and others blank.

**Dependencies:**
- `component-state-appearance-spec.json`
- `skeleton-loading-spec.json`
- `theme-spec.json`
- `empty-state-visual-spec.json`

**Downstream Consumers:**
- `visual-regression-baseline-spec`
- `handoff-visual-annotation-spec`

---

### 20. `empty-state-visual-spec`

**Frequency:** per-feature

**Input:**
- Empty state triggers (first-use / filtered / deleted / error-induced)
- Illustration library (from `illustration-usage-spec`)
- CTA visual requirements
- Copy token references

**Output:**
- `empty-state-visual-spec.json` — per-surface empty state visual treatment: trigger type, illustration reference (or icon reference), headline copy key, body copy key, CTA button variant reference, layout alignment (centered / left-aligned), dark mode variant

**Spec file:** `empty-state-visual-spec.spec.json`

**Correctness Gates:**
1. Every empty state has a visual treatment (illustration or icon — not blank)
2. Illustration references resolve in `illustration-usage-spec`
3. CTA button variant references a valid entry in `component-visual-variant-spec`
4. Copy keys exist in `copy-structure-spec` (UX compiler — cross-check)
5. Dark mode visual treatment is defined for every empty state
6. Error-induced empty states are visually distinct from true empty states (different illustration or icon)
7. Layout alignment is declared (centered or left-aligned — not implied)

**Error Codes:**
- `UI190` — Empty state has no visual treatment (blank)
- `UI191` — Illustration reference not found in illustration-usage-spec
- `UI192` — CTA variant not found in component-visual-variant-spec
- `UI193` — Copy key not found in copy-structure-spec
- `UI194` — Error-induced empty state not visually distinct from true empty

**Key Invariant:** Compiler must fail if any empty state surface has no illustration or icon defined.

**Safe Default:** Without empty-state-visual-spec, empty states render as blank white areas with no visual communication to the user.

**Dependencies:**
- `illustration-usage-spec.json`
- `component-visual-variant-spec.json`
- `icon-usage-spec.json`
- `dark-mode-spec.json`

**Downstream Consumers:**
- `visual-state-matrix`
- `handoff-visual-annotation-spec`

---

### 21. `form-field-visual-spec`

**Frequency:** per-project

**Input:**
- Field type list (text, textarea, select, multiselect, checkbox, radio, toggle, file, date)
- State list (default, focus, filled, error, disabled, read-only, loading)
- `theme-spec.json`
- `typography-scale-spec.json`
- `sizing-scale-spec.json`

**Output:**
- `form-field-visual-spec.json` — per-field-type, per-state visual token map: border color, background color, label position/style, placeholder style, error message style, helper text style, icon placement rules, size variants

**Spec file:** `form-field-visual-spec.spec.json`

**Correctness Gates:**
1. Every field type has all mandatory states defined: `default`, `focus`, `error`, `disabled`
2. Every state token references a semantic color from `color-system-spec`
3. Error state is visually distinct from focus state (not the same color)
4. Disabled state has reduced opacity and `cursor: not-allowed` defined
5. Label position is explicitly defined per state (floating / static / hidden)
6. All font references use tokens from `typography-scale-spec`
7. Field height references a size variant from `sizing-scale-spec`
8. Cross-compiler: field type list must cover every field type used in `react-form` artifacts

**Error Codes:**
- `UI200` — Field type missing mandatory state definition
- `UI201` — Error state visually identical to focus state
- `UI202` — Token reference not resolved in color-system-spec
- `UI203` — Field type not covered but used in react-form artifact
- `UI204` — Field height not from sizing-scale-spec

**Key Invariant:** Compiler must fail if the error state and focus state for any field type are visually indistinguishable.

**Safe Default:** Without form-field-visual-spec, form fields render inconsistently across features, with different error styles and focus indicators per implementation.

**Dependencies:**
- `theme-spec.json`
- `typography-scale-spec.json`
- `spacing-scale-spec.json`
- `sizing-scale-spec.json`
- `color-system-spec.json`

**Downstream Consumers:**
- `component-visual-variant-spec`
- `visual-state-matrix`
- `handoff-visual-annotation-spec`

---

### 22. `data-table-visual-spec`

**Frequency:** per-feature

**Input:**
- Table schema (column types, data densities)
- Density mode list (compact / comfortable / spacious)
- Row state list (default, hover, selected, disabled, loading, error)
- Sorting/filtering visual indicators
- `theme-spec.json`

**Output:**
- `data-table-visual-spec.json` — table visual rules: row height per density mode, cell padding tokens, header visual treatment, row state token map, sort indicator icon reference, filter active visual state, selection visual treatment, sticky header/column rules, overflow behavior

**Spec file:** `data-table-visual-spec.spec.json`

**Correctness Gates:**
1. Every density mode has a row height defined (in pixels, as token reference)
2. Every row state has a token map (background, text, border)
3. Sort indicator references an icon from `icon-usage-spec`
4. Selected row state is visually distinct from hover state
5. Sticky header background token is defined (prevents transparent sticky headers)
6. All padding values reference tokens from `spacing-scale-spec`
7. Long text overflow behavior is defined (`truncate` | `wrap` | `clip`) per column type
8. Cross-compiler: density modes must map to density modes in `spacing-scale-spec`

**Error Codes:**
- `UI210` — Density mode missing row height definition
- `UI211` — Row state missing token map
- `UI212` — Selected and hover states are visually identical
- `UI213` — Sticky header missing background token
- `UI214` — Long text overflow behavior not defined

**Key Invariant:** Compiler must fail if the selected row state and the hover state use identical visual treatments.

**Safe Default:** Without data-table-visual-spec, tables render with inconsistent density, undefined row states, and transparent sticky headers.

**Dependencies:**
- `theme-spec.json`
- `spacing-scale-spec.json`
- `typography-scale-spec.json`
- `icon-usage-spec.json`

**Downstream Consumers:**
- `visual-state-matrix`
- `handoff-visual-annotation-spec`
- `visual-regression-baseline-spec`

---

### 23. `chart-visualization-spec`

**Frequency:** per-feature

**Input:**
- Chart type list (bar, line, pie, donut, scatter, area, sparkline, heatmap)
- Data category color assignments
- Axis, label, and legend visual rules
- Empty and loading visual treatments
- Accessibility requirements (patterns, labels for color-only encoding)

**Output:**
- `chart-viz-spec.json` — per-chart-type visual rules: color sequence (ordered token list), axis line/label styles, grid line styles, legend placement and style, tooltip visual spec, empty state treatment, loading treatment, accessibility pattern overlays, dark mode overrides

**Spec file:** `chart-viz-spec.spec.json`

**Correctness Gates:**
1. Color sequence has sufficient colors for the declared maximum data category count
2. Colors in the sequence maintain minimum 3:1 contrast against chart background
3. Color-only data encoding has a pattern or shape alternative defined (accessibility)
4. Axis label typography references `typography-scale-spec` tokens
5. Dark mode color sequence is defined and distinct from light mode sequence
6. Empty state references an entry from `empty-state-visual-spec`
7. Loading state references an entry from `skeleton-loading-spec`
8. Tooltip visual treatment is defined (background, border, typography tokens)

**Error Codes:**
- `UI220` — Color sequence insufficient for declared maximum category count
- `UI221` — Chart color fails 3:1 contrast against chart background
- `UI222` — Color-only encoding with no pattern/shape alternative
- `UI223` — Dark mode color sequence not defined
- `UI224` — Empty or loading state not referenced

**Key Invariant:** Compiler must fail if any chart type uses color as the sole differentiator between data series with no pattern or shape alternative.

**Safe Default:** Without chart-visualization-spec, chart colors are arbitrary, color-only encoding causes accessibility failures, and dark mode renders incorrectly.

**Dependencies:**
- `color-system-spec.json`
- `theme-spec.json`
- `typography-scale-spec.json`
- `empty-state-visual-spec.json`
- `skeleton-loading-spec.json`

**Downstream Consumers:**
- `visual-state-matrix`
- `handoff-visual-annotation-spec`

---

### 24. `overlay-presentation-spec`

**Frequency:** per-project

**Input:**
- Overlay type list (modal, drawer, popover, tooltip, toast, bottom-sheet, dialog)
- Sizing rules per overlay type
- Backdrop behavior (blur, dim, none)
- Enter/exit animation references
- Stack behavior (multiple overlays)

**Output:**
- `overlay-spec.json` — per-overlay-type visual rules: width/height constraints, max-width per breakpoint, backdrop token (opacity, blur), shadow elevation reference, enter/exit motion references, z-index tier, stack behavior (replace/layer), close trigger list (escape, backdrop-click, close-button)

**Spec file:** `overlay-spec.spec.json`

**Correctness Gates:**
1. Every overlay type has defined width constraints per breakpoint
2. Backdrop color/opacity references semantic tokens (not raw rgba)
3. Enter/exit animations reference `motion-spec` entries
4. z-index values are from a declared z-index scale (no arbitrary z-index values)
5. Close triggers are explicitly enumerated for every overlay type
6. Mobile breakpoint sizing is defined separately (bottom-sheet pattern for drawers)
7. Toast/notification positioning is defined (top-right / bottom-center / etc.) per breakpoint

**Error Codes:**
- `UI230` — Overlay type missing width constraint for breakpoint
- `UI231` — Backdrop color is raw rgba (must reference token)
- `UI232` — Animation not referenced from motion-spec
- `UI233` — z-index not from declared z-index scale
- `UI234` — Close triggers not enumerated

**Key Invariant:** Compiler must fail if any overlay type has a z-index that is an arbitrary hardcoded value outside the declared z-index scale.

**Safe Default:** Without overlay-presentation-spec, modals and drawers have inconsistent sizing, z-index conflicts, and undefined backdrop behavior.

**Dependencies:**
- `theme-spec.json`
- `motion-spec.json`
- `radius-border-shadow-spec.json`
- `spacing-scale-spec.json`

**Downstream Consumers:**
- `component-visual-variant-spec`
- `handoff-visual-annotation-spec`

---

### 25. `visual-hierarchy-spec`

**Frequency:** per-feature

**Input:**
- Screen list with content priority map
- Typography scale from `typography-scale-spec`
- Emphasis rules (size, weight, color, spacing)
- `responsive-layout-spec.json`

**Output:**
- `visual-hierarchy-spec.json` — per-screen visual hierarchy definition: content priority tiers (primary/secondary/tertiary/metadata), assigned type step per tier, weight/color emphasis rules per tier, white-space rules, progressive disclosure rules

**Spec file:** `visual-hierarchy-spec.spec.json`

**Correctness Gates:**
1. Every screen has at least three content priority tiers defined
2. Every tier has an assigned type step from `typography-scale-spec`
3. Primary tier uses the largest or highest-weight type step on the screen (no primary tier using smaller type than secondary)
4. Color emphasis tokens reference `semantic-color-mapping-spec` entries
5. Progressive disclosure rules are binary (show/hide condition, not vague "when relevant")
6. White-space rules reference spacing tokens from `spacing-scale-spec`

**Error Codes:**
- `UI240` — Screen has fewer than three content priority tiers
- `UI241` — Primary tier type step smaller than secondary tier
- `UI242` — Color emphasis token not in semantic-color-mapping-spec
- `UI243` — Progressive disclosure rule is non-binary
- `UI244` — White-space rule references undefined spacing token

**Key Invariant:** Compiler must fail if any screen's primary content tier uses a smaller or lighter type step than its secondary tier.

**Safe Default:** Without visual-hierarchy-spec, content priority is arbitrary, causing visual noise and unclear user focus paths.

**Dependencies:**
- `typography-scale-spec.json`
- `spacing-scale-spec.json`
- `semantic-color-mapping-spec.json`
- `responsive-layout-spec.json`

**Downstream Consumers:**
- `handoff-visual-annotation-spec`
- `visual-regression-baseline-spec`

---

### 26. `semantic-color-mapping-spec`

**Frequency:** per-project

**Input:**
- `color-system.json`
- Semantic intent list (primary, secondary, destructive, success, warning, info, neutral, brand)
- Component context map (which components use which semantic colors in which states)
- Interactive vs static context rules

**Output:**
- `semantic-color-map.json` — per-intent semantic color mapping: intent name, role (background/foreground/border/icon), base token, hover token, active token, disabled token, dark mode token, high-contrast token

**Spec file:** `semantic-color-map.spec.json`

**Correctness Gates:**
1. Every semantic intent has mappings for all four roles: background, foreground, border, icon
2. All token references resolve in `color-system-spec`
3. Destructive intent foreground on destructive background passes contrast requirements
4. Every semantic intent has dark mode token mappings
5. Every semantic intent has high-contrast token mappings
6. No two semantic intents share identical token mappings (they must be visually distinguishable)

**Error Codes:**
- `UI250` — Semantic intent missing role mapping (background/foreground/border/icon)
- `UI251` — Token reference not resolved in color-system-spec
- `UI252` — Destructive foreground/background pair fails contrast
- `UI253` — Two semantic intents share identical token mappings
- `UI254` — High-contrast mapping missing for semantic intent

**Key Invariant:** Compiler must fail if any two semantic intents (e.g., success and info) produce identical visual outputs across all their token mappings.

**Safe Default:** Without semantic-color-mapping-spec, semantic colors are applied inconsistently — destructive red used for info states, success green for warnings, etc.

**Dependencies:**
- `color-system-spec.json`
- `theme-spec.json`
- `dark-mode-spec.json`
- `high-contrast-spec.json`

**Downstream Consumers:**
- `component-visual-variant-spec`
- `visual-hierarchy-spec`
- `form-field-visual-spec`
- `data-table-visual-spec`

---

### 27. `visual-regression-baseline-spec`

**Frequency:** per-feature

**Input:**
- Component and screen list
- `visual-state-matrix.json`
- Viewport list (mobile / tablet / desktop / wide)
- Theme mode list (light / dark / high-contrast)
- `component-visual-variant-spec.json`

**Output:**
- `visual-regression-spec.json` — baseline screenshot manifest: per-component/screen, per-state, per-viewport, per-theme-mode entry with: component ID, state, viewport, theme, baseline image path reference, tolerance threshold (percentage pixel diff), critical flag

**Spec file:** `visual-regression-spec.spec.json`

**Correctness Gates:**
1. Every component in `component-visual-variant-spec` has a baseline entry for every declared variant
2. Every screen has a baseline entry for every declared viewport
3. Every theme mode has a baseline entry (no mode can be skipped)
4. Tolerance threshold is a specific percentage value (not default assumed)
5. Critical-path screens are flagged with `critical: true` and have lower tolerance thresholds
6. Baseline entries reference existing component/screen IDs (no orphan entries)
7. Every state in `visual-state-matrix` has a baseline entry

**Error Codes:**
- `UI260` — Component variant missing visual regression baseline
- `UI261` — Screen missing viewport coverage in baseline
- `UI262` — Theme mode not covered in baseline
- `UI263` — Tolerance threshold not defined (cannot default to unknown)
- `UI264` — Baseline references non-existent component or screen ID

**Key Invariant:** Compiler must fail if any theme mode is absent from the baseline coverage for any critical-flagged screen.

**Safe Default:** Without visual-regression-baseline-spec, visual regressions go undetected in CI; dark mode and high-contrast breaking changes ship silently.

**Dependencies:**
- `component-visual-variant-spec.json`
- `component-state-appearance-spec.json`
- `visual-state-matrix.json`
- `theme-spec.json`

**Downstream Consumers:**
- CI visual regression tooling (Percy, Chromatic, Playwright visual)
- `design-system-drift-report`

---

### 28. `experiment-visual-variant-spec`

**Frequency:** per-experiment

**Input:**
- Feature flag config (`feature-flag` shared compiler output)
- Variant definitions (control + treatments)
- Token deltas per variant (which tokens change, not all tokens)
- Component deltas per variant (which component variant changes)
- `component-visual-variant-spec.json`

**Output:**
- `experiment-visual-spec.json` — per-variant visual definition: variant ID, flag key, token delta map (only changed tokens), component variant overrides, affected screen list, visual regression baseline override entries

**Spec file:** `experiment-visual-spec.spec.json`

**Correctness Gates:**
1. Every variant has a unique `variant_id`
2. Control variant is explicitly defined as the baseline
3. Every token delta references an existing token in `design-token-spec`
4. Every component variant override references an existing variant in `component-visual-variant-spec`
5. Cross-compiler: every `flag_key` exists in the `feature-flag` shared compiler output
6. Affected screen list is enumerated (not inferred)
7. Visual regression baseline overrides are defined for every affected screen/component

**Error Codes:**
- `UI270` — Control variant not explicitly defined
- `UI271` — Token delta references undefined token
- `UI272` — Component override references non-existent variant
- `UI273` — Flag key not found in feature-flag output
- `UI274` — Visual regression baseline not defined for affected screen

**Key Invariant:** Compiler must fail if any treatment variant modifies a token that does not exist in `design-token-spec`.

**Safe Default:** Without experiment-visual-variant-spec, A/B visual variants are hardcoded without token system, making rollback and measurement unreliable.

**Dependencies:**
- `component-visual-variant-spec.json`
- `design-token-spec.json`
- `theme-spec.json`
- `feature-flag` (shared compiler)

**Downstream Consumers:**
- `visual-regression-baseline-spec`
- `design-system-drift-report`

---

### 29. `handoff-visual-annotation-spec`

**Frequency:** per-feature

**Input:**
- `component-visual-variant-spec.json`
- `component-state-appearance-spec.json`
- `visual-state-matrix.json`
- `responsive-layout-spec.json`
- `motion-spec.json`

**Output:**
- `handoff-visual-annotations.json` — structured visual handoff: per-element annotation list with: element_id, annotation type (spacing/color/typography/motion/interaction), token reference, measured value, theme mode scope, viewport scope, note

**Spec file:** `handoff-visual-annotations.spec.json`

**Correctness Gates:**
1. Every annotated element has at least one token reference (no annotation is value-only)
2. Spacing annotations reference tokens from `spacing-scale-spec`
3. Color annotations reference tokens from `semantic-color-mapping-spec` or `color-system-spec`
4. Typography annotations reference tokens from `typography-scale-spec`
5. Motion annotations reference entries from `motion-spec`
6. Every element with a state change has state annotations for all states in `component-state-appearance-spec`
7. Cross-compiler: every element referenced exists in a `react-component` or `react-page` artifact

**Error Codes:**
- `UI280` — Annotation missing token reference (value-only annotation rejected)
- `UI281` — Spacing annotation references undefined spacing token
- `UI282` — Color annotation references undefined color token
- `UI283` — Motion annotation not referenced from motion-spec
- `UI284` — Annotated element not found in react-component or react-page artifact

**Key Invariant:** Compiler must fail if any annotation contains only a raw value with no token reference.

**Safe Default:** Without handoff-visual-annotation-spec, developers implement visual properties from screenshots alone, causing token-less hardcoded values in shipped components.

**Dependencies:**
- `component-visual-variant-spec.json`
- `component-state-appearance-spec.json`
- `visual-state-matrix.json`
- `responsive-layout-spec.json`
- `motion-spec.json`
- `semantic-color-mapping-spec.json`

**Downstream Consumers:**
- `react-component` (already built — consumes as reference)
- `react-page` (already built — consumes as reference)

---

### 30. `design-system-drift-report`

**Frequency:** daily

**Input:**
- `design-token-spec.json` (authoritative)
- `theme-spec.json` (authoritative)
- Shipped component CSS/token output (extracted from build)
- `visual-regression-baseline-spec.json`
- Previous day's drift report (for delta tracking)

**Output:**
- `drift-report.json` — design system drift audit: token coverage (tokens defined vs tokens consumed), unresolved token references in shipped components, hardcoded values detected in shipped components, visual regression failures from baseline, new tokens added since last report, deprecated tokens still in use

**Spec file:** `drift-report.spec.json`

**Correctness Gates:**
1. Report covers 100% of tokens defined in `design-token-spec`
2. Every hardcoded value in shipped components is flagged with component ID and property
3. Every unresolved token reference is flagged with component ID and token name
4. Deprecated tokens in use are enumerated (not silently ignored)
5. Visual regression failure count is reported per theme mode
6. Report includes a `token_coverage_score` (percentage of consumed values that are token-referenced)
7. Report timestamp and source artifact commit SHA are present

**Error Codes:**
- `UI290` — Hardcoded value detected in shipped component
- `UI291` — Unresolved token reference in shipped component
- `UI292` — Deprecated token still consumed
- `UI293` — Visual regression baseline failure in critical-flagged screen
- `UI294` — Token coverage score below declared minimum threshold

**Key Invariant:** Compiler must fail if any critical-flagged screen in the visual regression baseline has a pixel diff exceeding its declared tolerance threshold.

**Safe Default:** Without design-system-drift-report, token drift accumulates silently; shipped components diverge from the design system with no detection mechanism.

**Dependencies:**
- `design-token-spec.json`
- `theme-spec.json`
- `visual-regression-baseline-spec.json`
- Shipped component build output (CI artifact)

**Downstream Consumers:**
- Design team sprint planning
- Engineering debt tracking
- `design-token-spec` (feedback loop for deprecated token cleanup)

---

## Recommended Build Order

The build order follows strict dependency resolution. Primitive token compilers must precede semantic systems, which must precede component-level and feature-level compilers.

---

### Tier 0 — Primitive Foundations (no UI compiler dependencies)

These are the absolute roots. Nothing else can be built until these exist.

```
1. design-token-spec              ← all tokens, all tiers, all platforms
```

---

### Tier 1 — Primitive Scale Compilers (depend only on Tier 0)

```
2. color-system-spec              ← depends on: design-token-spec
3. typography-scale-spec          ← depends on: design-token-spec
4. spacing-scale-spec             ← depends on: design-token-spec
5. sizing-scale-spec              ← depends on: design-token-spec
6. radius-border-shadow-spec      ← depends on: design-token-spec, color-system-spec
```

---

### Tier 2 — System-Level Compilers (depend on Tier 1)

```
7.  theme-spec                    ← depends on: all Tier 1 compilers
8.  grid-layout-spec              ← depends on: spacing-scale-spec
9.  semantic-color-mapping-spec   ← depends on: color-system-spec
10. icon-usage-spec               ← depends on: sizing-scale-spec, color-system-spec, design-token-spec
```

---

### Tier 3 — Mode & Motion Compilers (depend on Tier 2)

```
11. dark-mode-spec                ← depends on: theme-spec, color-system-spec, radius-border-shadow-spec
12. high-contrast-spec            ← depends on: color-system-spec, theme-spec
13. motion-spec                   ← depends on: design-token-spec, a11y-test (shared)
14. illustration-usage-spec       ← depends on: dark-mode-spec, color-system-spec
```

---

### Tier 4 — Component & Interaction Visual Compilers (depend on Tier 3)

```
15. reduced-motion-spec           ← depends on: motion-spec, a11y-test (shared)
16. form-field-visual-spec        ← depends on: theme-spec, typography-scale-spec, spacing-scale-spec, sizing-scale-spec, color-system-spec
17. component-visual-variant-spec ← depends on: theme-spec + all scale specs + semantic-color-mapping-spec
18. responsive-layout-spec        ← depends on: grid-layout-spec, sizing-scale-spec
```

---

### Tier 5 — State & Feature Visual Compilers (depend on Tier 4)

```
19. component-state-appearance-spec ← depends on: component-visual-variant-spec, dark-mode-spec, high-contrast-spec
20. skeleton-loading-spec           ← depends on: theme-spec, motion-spec, reduced-motion-spec
21. empty-state-visual-spec         ← depends on: illustration-usage-spec, component-visual-variant-spec, dark-mode-spec
22. overlay-presentation-spec       ← depends on: theme-spec, motion-spec, radius-border-shadow-spec, spacing-scale-spec
23. data-table-visual-spec          ← depends on: theme-spec, spacing-scale-spec, typography-scale-spec, icon-usage-spec
```

---

### Tier 6 — Composite & Coverage Compilers (depend on Tier 5)

```
24. visual-state-matrix             ← depends on: component-state-appearance-spec, skeleton-loading-spec, empty-state-visual-spec, theme-spec
25. chart-visualization-spec        ← depends on: color-system-spec, theme-spec, typography-scale-spec, empty-state-visual-spec, skeleton-loading-spec
26. visual-hierarchy-spec           ← depends on: typography-scale-spec, spacing-scale-spec, semantic-color-mapping-spec, responsive-layout-spec
```

---

### Tier 7 — Handoff & Regression Compilers (depend on Tier 6 + full network)

```
27. handoff-visual-annotation-spec  ← depends on: component-visual-variant-spec, component-state-appearance-spec, visual-state-matrix, responsive-layout-spec, motion-spec, semantic-color-mapping-spec
28. visual-regression-baseline-spec ← depends on: component-visual-variant-spec, component-state-appearance-spec, visual-state-matrix, theme-spec
29. experiment-visual-variant-spec  ← depends on: component-visual-variant-spec, design-token-spec, theme-spec, feature-flag (shared)
```

---

### Tier 8 — Operational / Validation Compilers (depend on entire network)

```
30. design-system-drift-report      ← depends on: design-token-spec, theme-spec, visual-regression-baseline-spec + shipped build output
```

---

### Full Linear Build Order (safe DAG serialization)

```
1.  design-token-spec
2.  color-system-spec
3.  typography-scale-spec
4.  spacing-scale-spec
5.  sizing-scale-spec
6.  radius-border-shadow-spec
7.  theme-spec
8.  grid-layout-spec
9.  semantic-color-mapping-spec
10. icon-usage-spec
11. dark-mode-spec
12. high-contrast-spec
13. motion-spec
14. illustration-usage-spec
15. reduced-motion-spec
16. form-field-visual-spec
17. component-visual-variant-spec
18. responsive-layout-spec
19. component-state-appearance-spec
20. skeleton-loading-spec
21. empty-state-visual-spec
22. overlay-presentation-spec
23. data-table-visual-spec
24. visual-state-matrix
25. chart-visualization-spec
26. visual-hierarchy-spec
27. handoff-visual-annotation-spec
28. visual-regression-baseline-spec
29. experiment-visual-variant-spec
30. design-system-drift-report
```

---

*Document generated for: Domain Compiler Network — UI Designer Role*
*Total compilers defined: 30*
*Excludes: already-built compilers (9) and shared/cross-role compilers (5)*
*Cross-compiler checks defined against: react-component, react-form, react-page, ts-schema, a11y-test, feature-flag, i18n, openapi-spec, and UX compiler outputs (state-matrix, copy-structure-spec, sitemap)*
