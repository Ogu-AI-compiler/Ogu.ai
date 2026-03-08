---
name: ux-search-filter-sort
description: Compiler skill for the ux-search-filter-sort compiler. Activates when producing search-filter-sort-artifact.json. Gates: USS001–USS007. No upstream dependency.
---

# ux-search-filter-sort — Compiler Skill

## What This Compiler Does

Compiles the search, filter, and sort UX specification — entity type, filter definitions with valid types, sort options with explicit default direction, no-results state with recovery action, loading state type, and filter persistence strategy. Enforces: all filter types are valid, every sort entry declares its default direction, a no-results state with actionable recovery is present, a loading state type is declared, and filter persistence behavior is explicitly specified.

**Upstream dependency:** none
**Output artifact:** `search-filter-sort-artifact.json`
**IR identifier:** `UX_SEARCH_FILTER_SORT:{project}`

---

## Spec Shape

```json
{
  "version": "1.0",
  "entity": "products",
  "filters": [
    { "id": "category", "label": "Category", "type": "select" },
    { "id": "price-range", "label": "Price Range", "type": "range" },
    { "id": "in-stock", "label": "In Stock Only", "type": "boolean" },
    { "id": "tags", "label": "Tags", "type": "multi-select" }
  ],
  "sorts": [
    { "id": "price-asc", "label": "Price: Low to High", "field": "price", "defaultDirection": "asc" },
    { "id": "newest", "label": "Newest First", "field": "created_at", "defaultDirection": "desc" },
    { "id": "popularity", "label": "Most Popular", "field": "views", "defaultDirection": "desc" }
  ],
  "noResultsState": {
    "message": "No products match your filters.",
    "clearFiltersAction": true,
    "suggestionsEnabled": false
  },
  "loadingState": {
    "type": "skeleton"
  },
  "persistence": "url"
}
```

Required fields:
- `version` — string (required for contract gate)
- `entity` — non-empty string
- `filters` — array (can be empty, but each entry needs `id`, `label`, `type`)
- `sorts` — array (can be empty, but each entry needs `id`, `label`, `field`)

---

## Gates

### USS001 — spec-valid
Reads `search-filter-sort-spec.json`. Required: `entity` (string), `filters` (array), `sorts` (array). Each filter needs: `id`, `label`, `type`. Each sort needs: `id`, `label`, `field`.

### USS002 — no-results-state
`noResultsState` must be declared with:
- `message` (non-empty string)
- At least one of: `clearFiltersAction: true` or `suggestionsEnabled: true`

Escape hatch: `spec.noResultsHandledGlobally: true`

BAD: `noResultsState` missing entirely.
BAD:
```json
{ "noResultsState": { "message": "No results." } }
// No clearFiltersAction or suggestionsEnabled
```
GOOD:
```json
{ "noResultsState": { "message": "No products match your filters.", "clearFiltersAction": true } }
```

### USS003 — filter-types-valid
Every filter's `type` must be one of: `"text"`, `"select"`, `"multi-select"`, `"range"`, `"date-range"`, `"boolean"`, `"tag"`.

BAD:
```json
{ "type": "dropdown" }
{ "type": "checkbox-group" }
```
GOOD:
```json
{ "type": "multi-select" }
{ "type": "range" }
```

### USS004 — sort-direction
Every sort entry must declare `defaultDirection`: `"asc"` or `"desc"`. Missing direction means undefined initial sort order.

BAD:
```json
{ "id": "price", "label": "Price", "field": "price" }
// No defaultDirection
```
GOOD:
```json
{ "id": "price", "label": "Price: Low to High", "field": "price", "defaultDirection": "asc" }
```

### USS005 — partial-results
`loadingState` must be declared with `type`: `"skeleton"`, `"spinner"`, or `"progressive"`. Escape hatch: `spec.loadingHandledGlobally: true`.

BAD: `loadingState` missing.
BAD:
```json
{ "loadingState": { "type": "blur" } }
// Not a valid loading type
```
GOOD:
```json
{ "loadingState": { "type": "skeleton" } }
```

### USS006 — filter-persistence
`persistence` must be declared as one of: `"session"`, `"url"`, `"none"`, `"user-preference"`. Missing persistence means undefined behavior when the user navigates away and returns.

BAD: `persistence` missing.
BAD:
```json
{ "persistence": "localStorage" }
// Not a valid persistence mode
```
GOOD:
```json
{ "persistence": "url" }
{ "persistence": "session" }
{ "persistence": "none" }
```

### USS007 — contract-search-filter-sort
Final contract check:
- `version` declared
- `entity` is a non-empty string
- All filter `id` values are unique
- All sort `id` values are unique

---

## What This Compiler Never Forgives

- `search-filter-sort-spec.json` missing — gate skipped (soft, not hard-fail)
- `entity`, `filters`, or `sorts` missing (USS001)
- `noResultsState` missing (USS002)
- `noResultsState` without `message` or without `clearFiltersAction`/`suggestionsEnabled` (USS002)
- Invalid filter `type` (USS003)
- Sort entry without `defaultDirection` (USS004)
- `loadingState` missing or invalid `type` (USS005)
- `persistence` missing or invalid value (USS006)
- Duplicate filter or sort ids (USS007)
- `version` missing (USS007)
